const request = require("supertest");
const bcrypt = require("bcrypt");
const { randomUUID } = require("node:crypto");
const { createTestApp } = require("./helpers/create-test-app");
const { AUTH_SETTINGS } = require("../src/settings");

describe("New accounts and first reports through real HTTP and PostgreSQL", () => {
  let app,
    http,
    prisma,
    project,
    member,
    memberHeaders,
    memberCookie,
    invitedHeaders,
    invitedMemberId,
    invitedReportId,
    draftId;
  const users = [];
  const suffix = randomUUID();
  const password = "FirstReportTest123!";
  const week = { weekStart: "2026-08-31", weekEnd: "2026-09-06" };
  const roles = {};
  const login = async (email) =>
    request(http)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
  const headers = (loginResponse) => ({
    Authorization: `Bearer ${loginResponse.body.data.accessToken}`,
  });
  const memberRequest = (method, path) =>
    request(http)[method](`/api/v1${path}`).set(memberHeaders);
  const fullContent = {
    tasks: [
      {
        taskName: "  First delivery  ",
        priority: "HIGH",
        status: "DONE",
        plannedPercentage: 80,
        actualPercentage: 100,
        plannedMinutes: 120,
        actualMinutes: 90,
        deliverable: "Release notes",
      },
      {
        taskName: "Waiting for access",
        priority: "LOW",
        status: "BLOCKED",
        actualPercentage: 0,
        actualMinutes: 0,
      },
    ],
    nextWeekTasks: [
      { description: "Second", sortOrder: 1 },
      { description: "First", sortOrder: 0 },
    ],
    blockers: [
      { description: "Access approval", isKeyIssue: true, isResolved: false },
    ],
    achievements: [{ description: "First release", isKeyAchievement: true }],
    workHours: [
      { type: "DEVELOPMENT", minutes: 90 },
      { type: "TESTING", minutes: 30 },
    ],
    notes: "First weekly report notes",
  };

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
    const passwordHash = await bcrypt.hash(password, 4);
    // Only privileged test fixtures are inserted directly; members use the public HTTP flows.
    for (const role of ["ADMIN", "MANAGER"]) {
      const user = await prisma.user.create({
        data: {
          name: `First report ${role}`,
          email: `${role.toLowerCase()}-${suffix}@example.invalid`,
          role,
          passwordHash,
        },
      });
      users.push(user.id);
      roles[role] = headers(await login(user.email));
    }
    const created = await request(http)
      .post("/api/v1/projects")
      .set(roles.MANAGER)
      .send({ name: `First report project ${suffix}` })
      .expect(201);
    project = created.body.data;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        // Exact IDs created by this suite; never touch existing application or fixture users.
        await prisma.report.deleteMany({ where: { userId: { in: users } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
        if (project) await prisma.project.delete({ where: { id: project.id } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it("registers a new member, requires activation, and logs in with a real session", async () => {
    const email = `first-member-${suffix}@example.invalid`;
    const registration = await request(http)
      .post("/api/v1/auth/register")
      .send({ name: "  First Report Member  ", email, password })
      .expect(201);
    member = registration.body.data.user;
    users.push(member.id);
    expect(member).toMatchObject({
      name: "First Report Member",
      role: "TEAM_MEMBER",
      isActive: false,
    });
    expect(registration.body.data.accessToken).toBeUndefined();
    expect(member.passwordHash).toBeUndefined();
    await request(http)
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(401);
    await request(http)
      .patch(`/api/v1/users/${member.id}/status`)
      .set(roles.MANAGER)
      .send({ isActive: true })
      .expect(403);
    await request(http)
      .patch(`/api/v1/users/${member.id}/status`)
      .set(roles.ADMIN)
      .send({ isActive: true })
      .expect(200);
    const session = await login(email.toUpperCase());
    memberHeaders = headers(session);
    memberCookie = session.headers["set-cookie"][0].split(";")[0];
    expect(session.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(session.body.data.refreshToken).toBeUndefined();
    const empty = await memberRequest("get", "/reports/my").expect(200);
    expect(empty.body).toMatchObject({ data: [], meta: { total: 0 } });
    const summary = await memberRequest("get", "/reports/my/summary").expect(
      200,
    );
    expect(summary.body.data).toEqual({});
  });

  it("saves an incomplete first draft, keeps it private, and prevents premature submission", async () => {
    const created = await memberRequest("post", "/reports")
      .send(week)
      .expect(201);
    draftId = created.body.data.id;
    expect(created.body.data).toMatchObject({
      userId: member.id,
      status: "DRAFT",
      latestVersionNumber: 0,
      projectId: null,
      tasks: [],
    });
    await memberRequest("post", `/reports/${draftId}/submit`).expect(400);
    await memberRequest("patch", `/reports/${draftId}`)
      .send({ tasks: [{ taskName: "Initial task" }] })
      .expect(200);
    await memberRequest("post", `/reports/${draftId}/submit`).expect(400);
    expect(
      await prisma.reportVersion.count({ where: { reportId: draftId } }),
    ).toBe(0);
    await request(http)
      .get(`/api/v1/manager/reports/${draftId}`)
      .set(roles.MANAGER)
      .expect(403);
    await request(http)
      .get(`/api/v1/manager/reports/${draftId}`)
      .set(roles.ADMIN)
      .expect(403);
    const roster = await request(http)
      .get("/api/v1/manager/dashboard/roster")
      .set(roles.MANAGER)
      .query({ ...week, userId: member.id })
      .expect(200);
    expect(roster.body.data).toEqual([
      expect.objectContaining({
        userId: member.id,
        status: "DRAFT",
        reportId: null,
        submitted: false,
      }),
    ]);
    const own = await memberRequest("get", "/reports/my").expect(200);
    expect(own.body.meta.total).toBe(1);
  });

  it("rejects malformed and over-limit content without partially changing the draft", async () => {
    const badUpdates = [
      { tasks: null },
      { tasks: [null] },
      { tasks: [{ taskName: " " }] },
      { tasks: [{ taskName: "Task", plannedPercentage: 101 }] },
      { tasks: [{ taskName: "Task", actualMinutes: 1.5 }] },
      { workHours: [{ type: "DEVELOPMENT", minutes: -1 }] },
      { tasks: Array.from({ length: 51 }, () => ({ taskName: "Task" })) },
      { weekStart: "2026-09-01", weekEnd: "2026-09-07" },
      { weekStart: "2026-02-30" },
      { weekStart: "2026-08-31T00:00:00Z" },
      { projectId: "invalid" },
      { notes: "x".repeat(2001) },
      {
        blockers: [
          { description: "A", isKeyIssue: true },
          { description: "B", isKeyIssue: true },
        ],
      },
      {
        achievements: [
          { description: "A", isKeyAchievement: true },
          { description: "B", isKeyAchievement: true },
        ],
      },
      { userId: users[0] },
      { status: "APPROVED" },
    ];
    for (const update of badUpdates)
      await memberRequest("patch", `/reports/${draftId}`)
        .send(update)
        .expect(400);
    const unchanged = await memberRequest("get", `/reports/${draftId}`).expect(
      200,
    );
    expect(unchanged.body.data).toMatchObject({
      status: "DRAFT",
      latestVersionNumber: 0,
      projectId: null,
      tasks: [expect.objectContaining({ taskName: "Initial task" })],
    });
  });

  it("persists every section, trims text, and preserves omitted collections on partial saves", async () => {
    const saved = await memberRequest("patch", `/reports/${draftId}`)
      .send({ ...fullContent, projectId: project.id })
      .expect(200);
    expect(saved.body.data.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskName: "First delivery",
          priority: "HIGH",
          actualMinutes: 90,
        }),
      ]),
    );
    expect(
      saved.body.data.nextWeekTasks.map((task) => task.description),
    ).toEqual(["First", "Second"]);
    expect(saved.body.data).toMatchObject({
      blockers: fullContent.blockers,
      achievements: fullContent.achievements,
      workHours: fullContent.workHours,
    });
    await memberRequest("patch", `/reports/${draftId}`)
      .send({ notes: "Saved first report" })
      .expect(200);
    const reloaded = await memberRequest("get", `/reports/${draftId}`).expect(
      200,
    );
    expect(reloaded.body.data.tasks).toHaveLength(2);
    expect(reloaded.body.data.workHours).toHaveLength(2);
    expect(reloaded.body.data.notes).toBe("Saved first report");
  });

  it("creates an admin-invited member whose first TODO report can be submitted", async () => {
    const email = `invited-member-${suffix}@example.invalid`;
    const invitation = await request(http)
      .post("/api/v1/users")
      .set(roles.ADMIN)
      .send({
        name: "Invited First Reporter",
        email,
        password,
        role: "TEAM_MEMBER",
      })
      .expect(201);
    users.push(invitation.body.data.id);
    invitedMemberId = invitation.body.data.id;
    expect(invitation.body.data).toMatchObject({
      role: "TEAM_MEMBER",
      isActive: true,
    });
    expect(invitation.body.data.passwordHash).toBeUndefined();
    invitedHeaders = headers(await login(email));
    const empty = await request(http)
      .get("/api/v1/reports/my")
      .set(invitedHeaders)
      .expect(200);
    expect(empty.body.meta.total).toBe(0);
    const first = await request(http)
      .post("/api/v1/reports")
      .set(invitedHeaders)
      .send({
        ...week,
        projectId: project.id,
        tasks: [{ taskName: "Planned work", status: "TODO", actualMinutes: 0 }],
      })
      .expect(201);
    const submission = await request(http)
      .post(`/api/v1/reports/${first.body.data.id}/submit`)
      .set(invitedHeaders)
      .expect(200);
    invitedReportId = submission.body.data.id;
    expect(submission.body.data).toMatchObject({
      status: "SUBMITTED",
      latestVersionNumber: 1,
    });
    await request(http)
      .get(`/api/v1/reports/${draftId}`)
      .set(invitedHeaders)
      .expect(403);
    await request(http)
      .patch(`/api/v1/reports/${draftId}`)
      .set(invitedHeaders)
      .send({ notes: "Not mine" })
      .expect(403);
    await request(http)
      .post(`/api/v1/reports/${draftId}/submit`)
      .set(invitedHeaders)
      .expect(403);
  });

  it("shows the same submitted week as SUBMITTED and the next week as NOT_STARTED on manager and admin dashboards", async () => {
    // Regression for "member sees SUBMITTED but manager sees NOT_STARTED":
    // that report belongs to the previous reporting week. The roster must show
    // SUBMITTED for the submitted week and NOT_STARTED for every other week,
    // for both privileged roles, using the exact week the member submitted.
    const nextWeek = { weekStart: "2026-09-07", weekEnd: "2026-09-13" };
    for (const authHeaders of [roles.MANAGER, roles.ADMIN]) {
      const submittedWeek = await request(http)
        .get("/api/v1/manager/dashboard/roster")
        .set(authHeaders)
        .query({ ...week, userId: invitedMemberId })
        .expect(200);
      expect(submittedWeek.body.data).toEqual([
        expect.objectContaining({
          userId: invitedMemberId,
          weekStart: new Date(week.weekStart).toISOString(),
          status: "SUBMITTED",
          reportId: invitedReportId,
          submitted: true,
        }),
      ]);

      const followingWeek = await request(http)
        .get("/api/v1/manager/dashboard/roster")
        .set(authHeaders)
        .query({ ...nextWeek, userId: invitedMemberId })
        .expect(200);
      expect(followingWeek.body.data).toEqual([
        expect.objectContaining({
          userId: invitedMemberId,
          status: "NOT_STARTED",
          reportId: null,
          submitted: false,
        }),
      ]);
    }

    // Summary numbers are global to the database (other suites share the
    // schema), so assert the invariants this test's data controls.
    const summary = await request(http)
      .get("/api/v1/manager/dashboard/summary")
      .set(roles.MANAGER)
      .query(week)
      .expect(200);
    expect(summary.body.data.submittedCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.draftCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.data.complianceRate).toBeGreaterThan(0);
    // The following week has no submissions at all: every active member is
    // still pending there, including both members this suite created.
    const nextWeekSummary = await request(http)
      .get("/api/v1/manager/dashboard/summary")
      .set(roles.MANAGER)
      .query(nextWeek)
      .expect(200);
    expect(nextWeekSummary.body.data).toMatchObject({
      submittedCount: 0,
    });
    expect(nextWeekSummary.body.data.notStartedCount).toBeGreaterThanOrEqual(2);
  });

  it("allows only one draft when two creation requests race for the same member/week", async () => {
    const next = {
      weekStart: "2026-09-07",
      weekEnd: "2026-09-13",
      projectId: project.id,
      tasks: [{ taskName: "Race-safe draft" }],
    };
    const responses = await Promise.all([
      memberRequest("post", "/reports").send(next),
      memberRequest("post", "/reports").send(next),
    ]);
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    const duplicate = responses.find((response) => response.status !== 201);
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toBe(
      "A weekly report already exists for this week.",
    );
    const stored = await prisma.report.findMany({
      where: { userId: member.id, weekStart: new Date(next.weekStart) },
      include: { tasks: true },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].tasks).toHaveLength(1);
    await memberRequest("patch", `/reports/${stored[0].id}`)
      .send(week)
      .expect(400);
  });

  it("serializes concurrent submissions and stores one complete immutable version", async () => {
    const responses = await Promise.all([
      memberRequest("post", `/reports/${draftId}/submit`),
      memberRequest("post", `/reports/${draftId}/submit`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    const history = await memberRequest(
      "get",
      `/reports/${draftId}/versions`,
    ).expect(200);
    expect(history.body.data).toHaveLength(1);
    const snapshot = history.body.data[0].snapshotJson;
    expect(snapshot).toMatchObject({
      status: "SUBMITTED",
      projectName: project.name,
      notes: "Saved first report",
      blockers: fullContent.blockers,
      achievements: fullContent.achievements,
      workHours: fullContent.workHours,
    });
    expect(snapshot.tasks).toHaveLength(2);
    expect(snapshot.nextWeekTasks.map((task) => task.description)).toEqual([
      "First",
      "Second",
    ]);
    await memberRequest("patch", `/reports/${draftId}`)
      .send({ notes: "Forbidden overwrite" })
      .expect(403);
    await request(http)
      .get(`/api/v1/manager/reports/${draftId}`)
      .set(roles.MANAGER)
      .expect(200);
  });

  it("corrects, resubmits and approves the first report with accurate version history", async () => {
    const old = (
      await memberRequest("get", `/reports/${draftId}/versions`).expect(200)
    ).body.data[0];
    await request(http)
      .post(`/api/v1/manager/reports/${draftId}/request-changes`)
      .set(roles.MANAGER)
      .send({ comment: "Please include the final delivery." })
      .expect(200);
    await memberRequest("patch", `/reports/${draftId}`)
      .send({
        tasks: [
          {
            taskName: "Final delivery",
            status: "DONE",
            actualPercentage: 100,
            actualMinutes: 120,
          },
        ],
        nextWeekTasks: [],
        blockers: [],
        achievements: [],
        workHours: [{ type: "DEVELOPMENT", minutes: 120 }],
        notes: "Corrected first report",
      })
      .expect(200);
    await request(http)
      .patch(`/api/v1/projects/${project.id}`)
      .set(roles.MANAGER)
      .send({ name: "Renamed first report project" })
      .expect(200);
    await memberRequest("post", `/reports/${draftId}/submit`).expect(200);
    const approvals = await Promise.all([
      request(http)
        .post(`/api/v1/manager/reports/${draftId}/approve`)
        .set(roles.MANAGER),
      request(http)
        .post(`/api/v1/manager/reports/${draftId}/approve`)
        .set(roles.MANAGER),
    ]);
    expect(approvals.map((response) => response.status).sort()).toEqual([
      200, 400,
    ]);
    const final = (
      await memberRequest("get", `/reports/${draftId}`).expect(200)
    ).body.data;
    expect(final).toMatchObject({
      status: "APPROVED",
      latestVersionNumber: 2,
      nextWeekTasks: [],
      blockers: [],
      achievements: [],
      notes: "Corrected first report",
    });
    expect(final.versions).toHaveLength(2);
    expect(final.versions[1].snapshotJson).toEqual(old.snapshotJson);
    expect(final.versions[0].snapshotJson).toMatchObject({
      status: "SUBMITTED",
      projectName: "Renamed first report project",
      tasks: [expect.objectContaining({ taskName: "Final delivery" })],
    });
    expect(final.reviews).toHaveLength(2);
    expect(
      final.reviews.find((review) => review.action === "APPROVED").reportVersion
        .versionNumber,
    ).toBe(2);
    expect(
      final.reviews.find((review) => review.action === "CHANGES_REQUESTED")
        .reportVersion.versionNumber,
    ).toBe(1);
    await memberRequest("patch", `/reports/${draftId}`)
      .send({ notes: "Locked" })
      .expect(403);
    await memberRequest("post", `/reports/${draftId}/submit`).expect(400);
    const roster = await request(http)
      .get("/api/v1/manager/dashboard/roster")
      .set(roles.MANAGER)
      .query({ ...week, userId: member.id })
      .expect(200);
    expect(roster.body.data).toEqual([
      expect.objectContaining({
        userId: member.id,
        status: "APPROVED",
        reportId: draftId,
        submitted: true,
        submittedAt: old.submittedAt,
      }),
    ]);
    const summary = await memberRequest("get", "/reports/my/summary").expect(
      200,
    );
    expect(summary.body.data).toMatchObject({ APPROVED: 1, DRAFT: 1 });
  });

  it("rejects inactive projects and invalidates a deactivated member's existing session", async () => {
    await request(http)
      .delete(`/api/v1/projects/${project.id}`)
      .set(roles.MANAGER)
      .expect(200);
    const unavailableProjectReport = {
      weekStart: "2026-08-24",
      weekEnd: "2026-08-30",
      tasks: [{ taskName: "Project validation work" }],
    };
    await memberRequest("post", "/reports")
      .send({ ...unavailableProjectReport, projectId: project.id })
      .expect(400);
    await memberRequest("post", "/reports")
      .send({ ...unavailableProjectReport, projectId: randomUUID() })
      .expect(404);
    await request(http)
      .patch(`/api/v1/users/${member.id}/status`)
      .set(roles.ADMIN)
      .send({ isActive: false })
      .expect(200);
    await memberRequest("get", "/reports/my").expect(401);
    await memberRequest("post", "/reports")
      .send(unavailableProjectReport)
      .expect(401);
    await request(http)
      .post("/api/v1/auth/refresh")
      .set("Cookie", memberCookie)
      .set(AUTH_SETTINGS.csrfHeaderName, AUTH_SETTINGS.csrfHeaderValue)
      .expect(403);
    expect(await prisma.report.count({ where: { userId: member.id } })).toBe(2);
  });
});
