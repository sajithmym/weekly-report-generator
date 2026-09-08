const { JwtService } = require("@nestjs/jwt");
const request = require("supertest");
const bcrypt = require("bcrypt");
const { createTestApp } = require("./helpers/create-test-app");
const { ReportsService } = require("../src/reports/reports.service");
const { AUTH_SETTINGS, SERVER_SETTINGS } = require("../src/settings");

describe("HTTP authorization, reports, and dashboard with an isolated PostgreSQL schema", () => {
  let app,
    prisma,
    http,
    member,
    other,
    manager,
    admin,
    project,
    tokens,
    reportId,
    invitedUserId;
  const dates = { weekStart: "2026-08-31", weekEnd: "2026-09-06" };
  const task = {
    taskName: "Deliver feature",
    status: "DONE",
    plannedPercentage: 80,
    actualPercentage: 100,
    plannedMinutes: 90,
    actualMinutes: 80,
    deliverable: "Release evidence",
  };
  const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
    const passwordHash = await bcrypt.hash("password123", 4);
    [member, other, manager, admin] = await Promise.all(
      ["TEAM_MEMBER", "TEAM_MEMBER", "MANAGER", "ADMIN"].map((role, index) =>
        prisma.user.create({
          data: {
            name: `Fixture ${index}`,
            email: `fixture${index}@example.invalid`,
            passwordHash,
            role,
          },
        }),
      ),
    );
    project = await prisma.project.create({
      data: { name: "Fixture project" },
    });
    const jwt = new JwtService({ secret: AUTH_SETTINGS.jwtAccessSecret });
    tokens = Object.fromEntries(
      [
        ["member", member],
        ["other", other],
        ["manager", manager],
        ["admin", admin],
      ].map(([key, user]) => [
        key,
        jwt.sign({ sub: user.id, email: user.email, role: user.role }),
      ]),
    );
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it("returns 503 when the PostgreSQL health probe fails", async () => {
    const probe = jest
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("connection lost"));

    try {
      const response = await request(http).get("/api/v1/health").expect(503);
      expect(response.body).toMatchObject({
        success: false,
        statusCode: 503,
        code: "SERVICE_UNAVAILABLE",
        message: "Service is unhealthy",
        data: null,
      });
    } finally {
      probe.mockRestore();
    }
  });

  it("serves a healthy API through the production middleware configuration", async () => {
    const response = await request(http)
      .get("/api/v1/health")
      .set("Origin", SERVER_SETTINGS.frontendUrl)
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      statusCode: 200,
      data: { status: "ok", database: "connected" },
    });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["access-control-allow-origin"]).toBe(
      SERVER_SETTINGS.frontendUrl,
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rejects anonymous access, member manager-access, and manager admin-access", async () => {
    await request(http).get("/api/v1/reports/my").expect(401);
    await request(http)
      .get("/api/v1/manager/reports")
      .set(auth("member"))
      .expect(403);
    await request(http)
      .patch(`/api/v1/users/${other.id}/role`)
      .set(auth("manager"))
      .send({ role: "ADMIN" })
      .expect(403);
    await request(http)
      .post("/api/v1/projects")
      .set(auth("member"))
      .send({ name: "Forbidden project" })
      .expect(403);
    const invited = await request(http)
      .post("/api/v1/users")
      .set(auth("admin"))
      .send({
        name: "Invited user",
        email: "invited@example.invalid",
        password: "password123",
        role: "MANAGER",
      })
      .expect(201);
    invitedUserId = invited.body.data.id;
    expect(invited.body).toMatchObject({
      success: true,
      statusCode: 201,
      data: { email: "invited@example.invalid", role: "MANAGER" },
    });
  });

  it("returns a consistent error envelope and enforces browser-session CSRF checks", async () => {
    const invalidLogin = await request(http)
      .post("/api/v1/auth/login")
      .send({ email: member.email })
      .expect(400);
    expect(invalidLogin.body).toMatchObject({
      success: false,
      statusCode: 400,
      code: "BAD_REQUEST",
      data: null,
    });
    await request(http)
      .post("/api/v1/auth/refresh")
      .expect(403);
    await request(http)
      .post("/api/v1/auth/logout")
      .expect(403);
    const profile = await request(http)
      .get("/api/v1/auth/me")
      .set(auth("manager"))
      .expect(200);
    expect(profile.body.data).toMatchObject({
      id: manager.id,
      email: manager.email,
      role: "MANAGER",
    });
    expect(profile.body.data.passwordHash).toBeUndefined();
  });

  it("keeps self-registered accounts pending until an administrator activates them", async () => {
    const credentials = {
      name: "Awaiting Approval",
      email: "awaiting-approval@example.invalid",
      password: "password123",
    };
    const registration = await request(http)
      .post("/api/v1/auth/register")
      .send(credentials)
      .expect(201);

    expect(registration.headers["set-cookie"]).toBeUndefined();
    expect(registration.body.data).toMatchObject({
      user: {
        name: credentials.name,
        email: credentials.email,
        role: "TEAM_MEMBER",
        isActive: false,
      },
    });
    expect(registration.body.data.accessToken).toBeUndefined();

    await request(http)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(401);

    await request(http)
      .patch(`/api/v1/users/${registration.body.data.user.id}/status`)
      .set(auth("admin"))
      .send({ isActive: true })
      .expect(200);

    const login = await request(http)
      .post("/api/v1/auth/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    expect(login.body.data).toMatchObject({
      user: { email: credentials.email, isActive: true },
      accessToken: expect.any(String),
    });
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");

    const duplicate = await request(http)
      .post("/api/v1/auth/register")
      .send(credentials)
      .expect(409);
    expect(duplicate.body).toMatchObject({
      success: false,
      statusCode: 409,
      code: "CONFLICT",
      message: "Email already registered",
    });
  });

  it("manages users and projects with role-aware filtering and pagination", async () => {
    const users = await request(http)
      .get("/api/v1/users")
      .query({ search: "Fixture 1", role: "TEAM_MEMBER", page: 1, limit: 1 })
      .set(auth("manager"))
      .expect(200);
    expect(users.body).toMatchObject({
      success: true,
      data: [expect.objectContaining({ id: other.id, email: other.email })],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });
    expect(users.body.data[0].passwordHash).toBeUndefined();
    await request(http)
      .get(`/api/v1/users/${other.id}`)
      .set(auth("manager"))
      .expect(200);
    await request(http)
      .get("/api/v1/users/11111111-1111-4111-8111-111111111111")
      .set(auth("manager"))
      .expect(404);
    await request(http)
      .get("/api/v1/users/missing-user")
      .set(auth("manager"))
      .expect(400);
    await request(http)
      .patch(`/api/v1/users/${admin.id}/role`)
      .set(auth("admin"))
      .send({ role: "MANAGER" })
      .expect(403);
    await request(http)
      .patch(`/api/v1/users/${admin.id}/status`)
      .set(auth("admin"))
      .send({ isActive: false })
      .expect(403);
    await request(http)
      .patch(`/api/v1/users/${invitedUserId}/status`)
      .set(auth("admin"))
      .send({ isActive: false })
      .expect(200);
    const inactiveManagers = await request(http)
      .get("/api/v1/users")
      .query({ role: "MANAGER", isActive: false })
      .set(auth("admin"))
      .expect(200);
    expect(inactiveManagers.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: invitedUserId })]),
    );

    const secondary = await request(http)
      .post("/api/v1/projects")
      .set(auth("manager"))
      .send({ name: "Secondary project", description: "Before update" })
      .expect(201);
    const secondaryId = secondary.body.data.id;
    const updated = await request(http)
      .patch(`/api/v1/projects/${secondaryId}`)
      .set(auth("manager"))
      .send({ name: "Secondary project updated", description: "After update" })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      id: secondaryId,
      name: "Secondary project updated",
      description: "After update",
    });
    const projectSearch = await request(http)
      .get("/api/v1/projects")
      .query({ search: "UPDATED", page: 1, limit: 1 })
      .set(auth("member"))
      .expect(200);
    expect(projectSearch.body).toMatchObject({
      data: [expect.objectContaining({ id: secondaryId })],
      meta: { total: 1 },
    });
    await request(http)
      .delete(`/api/v1/projects/${secondaryId}`)
      .set(auth("manager"))
      .expect(200);
    const archived = await request(http)
      .get("/api/v1/projects")
      .query({ isActive: false })
      .set(auth("member"))
      .expect(200);
    expect(archived.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: secondaryId, isActive: false }),
      ]),
    );
  });

  it("creates private drafts and rejects blank fields/null arrays", async () => {
    await request(http)
      .post("/api/v1/reports")
      .set(auth("member"))
      .send({ ...dates, tasks: [{ taskName: "  " }] })
      .expect(400);
    const response = await request(http)
      .post("/api/v1/reports")
      .set(auth("member"))
      .send({
        ...dates,
        projectId: project.id,
        tasks: [task],
        nextWeekTasks: [{ description: "Next delivery" }],
        blockers: [{ description: "Waiting for review", isKeyIssue: true }],
        achievements: [{ description: "Delivered baseline", isKeyAchievement: true }],
        workHours: [
          { type: "DEVELOPMENT", minutes: 75 },
          { type: "TESTING", minutes: 45 },
        ],
        notes: "Original notes",
      })
      .expect(201);
    reportId = response.body.data.id;
    expect(response.body.data).toMatchObject({
      status: "DRAFT",
      tasks: [task],
      blockers: [expect.objectContaining({ isKeyIssue: true })],
      achievements: [expect.objectContaining({ isKeyAchievement: true })],
    });
    const myReports = await request(http)
      .get("/api/v1/reports/my")
      .query({ page: 1, limit: 1 })
      .set(auth("member"))
      .expect(200);
    expect(myReports.body).toMatchObject({
      data: [expect.objectContaining({ id: reportId, status: "DRAFT" })],
      meta: { page: 1, limit: 1, total: 1 },
    });
    const summary = await request(http)
      .get("/api/v1/reports/my/summary")
      .set(auth("member"))
      .expect(200);
    expect(summary.body.data).toMatchObject({ DRAFT: 1 });
    const ownReport = await request(http)
      .get(`/api/v1/reports/${reportId}`)
      .set(auth("member"))
      .expect(200);
    expect(ownReport.body.data).toMatchObject({
      id: reportId,
      notes: "Original notes",
      project: { id: project.id },
    });
    await request(http)
      .post("/api/v1/reports")
      .set(auth("member"))
      .send({ ...dates, projectId: project.id, tasks: [task] })
      .expect(400);
    await request(http)
      .get(`/api/v1/reports/${reportId}`)
      .set(auth("other"))
      .expect(403);
    await request(http)
      .get(`/api/v1/manager/reports/${reportId}`)
      .set(auth("manager"))
      .expect(403);
    const list = await request(http)
      .get("/api/v1/manager/reports")
      .set(auth("manager"))
      .expect(200);
    expect(list.body.data).toEqual([]);
    await request(http)
      .patch(`/api/v1/reports/${reportId}`)
      .set(auth("member"))
      .send({ tasks: null })
      .expect(400);
    await request(http)
      .patch(`/api/v1/reports/${reportId}`)
      .set(auth("manager"))
      .send({ notes: "Forbidden edit" })
      .expect(403);
  });

  it("tracks draft/not-started metadata without leaking draft content", async () => {
    const roster = await request(http)
      .get("/api/v1/manager/dashboard/roster")
      .query(dates)
      .set(auth("manager"))
      .expect(200);
    expect(
      roster.body.data.find((row) => row.userId === member.id),
    ).toMatchObject({ status: "DRAFT", reportId: null });
    expect(
      roster.body.data.find((row) => row.userId === other.id),
    ).toMatchObject({ status: "NOT_STARTED", reportId: null });
    expect(JSON.stringify(roster.body)).not.toContain("Original notes");
    const summary = await request(http)
      .get("/api/v1/manager/dashboard/summary")
      .query(dates)
      .set(auth("manager"))
      .expect(200);
    expect(summary.body.data).toMatchObject({
      complianceRate: 0,
      pendingCount: 3,
      submittedCount: 0,
    });
  });

  it("completes correction/resubmission/approval and preserves full versions with associated comments", async () => {
    await request(http)
      .post(`/api/v1/reports/${reportId}/submit`)
      .set(auth("member"))
      .expect(200);
    await request(http)
      .patch(`/api/v1/reports/${reportId}`)
      .set(auth("member"))
      .send({ notes: "Locked" })
      .expect(403);
    await request(http)
      .post(`/api/v1/manager/reports/${reportId}/request-changes`)
      .set(auth("manager"))
      .send({ comment: " " })
      .expect(400);
    await request(http)
      .post(`/api/v1/manager/reports/${reportId}/request-changes`)
      .set(auth("manager"))
      .send({ comment: "Please improve the output." })
      .expect(200);
    await request(http)
      .patch(`/api/v1/reports/${reportId}`)
      .set(auth("member"))
      .send({ notes: "Revised notes" })
      .expect(200);
    await request(http)
      .post(`/api/v1/reports/${reportId}/submit`)
      .set(auth("member"))
      .expect(200);
    await request(http)
      .post(`/api/v1/manager/reports/${reportId}/approve`)
      .set(auth("manager"))
      .expect(200);
    await request(http)
      .post(`/api/v1/manager/reports/${reportId}/approve`)
      .set(auth("manager"))
      .expect(400);
    await request(http)
      .patch(`/api/v1/reports/${reportId}`)
      .set(auth("member"))
      .send({ notes: "Locked" })
      .expect(403);
    const result = await request(http)
      .get(`/api/v1/manager/reports/${reportId}`)
      .set(auth("manager"))
      .expect(200);
    expect(result.body.data.versions).toHaveLength(2);
    expect(result.body.data.versions[0].snapshotJson.notes).toBe(
      "Revised notes",
    );
    expect(result.body.data.versions[1].snapshotJson).toMatchObject({
      notes: "Original notes",
      tasks: [task],
      nextWeekTasks: [{ description: "Next delivery" }],
    });
    expect(
      result.body.data.reviews.find(
        (review) => review.action === "CHANGES_REQUESTED",
      ).reportVersion.versionNumber,
    ).toBe(1);
    expect(
      result.body.data.reviews.find((review) => review.action === "APPROVED")
        .reportVersion.versionNumber,
    ).toBe(2);
    const summary = await request(http)
      .get("/api/v1/manager/dashboard/summary")
      .query(dates)
      .set(auth("manager"))
      .expect(200);
    expect(summary.body.data).toMatchObject({
      submittedCount: 1,
      approvedCount: 1,
      expectedCount: 3,
      complianceRate: 33,
    });
    const history = await request(http)
      .get(`/api/v1/reports/${reportId}/versions`)
      .set(auth("member"))
      .expect(200);
    expect(history.body.data).toHaveLength(2);
    const filteredReports = await request(http)
      .get("/api/v1/manager/reports")
      .query({
        userId: member.id,
        projectId: project.id,
        status: "APPROVED",
        weekStart: dates.weekStart,
        weekEnd: dates.weekEnd,
      })
      .set(auth("manager"))
      .expect(200);
    expect(filteredReports.body).toMatchObject({
      data: [expect.objectContaining({ id: reportId, status: "APPROVED" })],
      meta: { total: 1 },
    });
    const draftFilter = await request(http)
      .get("/api/v1/manager/reports")
      .query({ status: "DRAFT" })
      .set(auth("manager"))
      .expect(200);
    expect(draftFilter.body).toMatchObject({ data: [], meta: { total: 0 } });
  });

  it("returns all dashboard analytics with validated filters and no draft-content leaks", async () => {
    const commonQuery = dates;
    const [distribution, trends, time, activity, approvedRoster] =
      await Promise.all([
        request(http)
          .get("/api/v1/manager/dashboard/status-distribution")
          .query(commonQuery)
          .set(auth("manager"))
          .expect(200),
        request(http)
          .get("/api/v1/manager/dashboard/task-trends")
          .query({ weeks: 1, weekEnd: dates.weekEnd })
          .set(auth("manager"))
          .expect(200),
        request(http)
          .get("/api/v1/manager/dashboard/time-distribution")
          .query(commonQuery)
          .set(auth("manager"))
          .expect(200),
        request(http)
          .get("/api/v1/manager/dashboard/activity")
          .query({ ...commonQuery, limit: 1 })
          .set(auth("manager"))
          .expect(200),
        request(http)
          .get("/api/v1/manager/dashboard/roster")
          .query({ ...commonQuery, status: "APPROVED", page: 1, limit: 1 })
          .set(auth("manager"))
          .expect(200),
      ]);
    expect(distribution.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "APPROVED", count: 1 }),
        expect.objectContaining({ status: "NOT_STARTED", count: 2 }),
      ]),
    );
    expect(trends.body.data).toEqual([
      expect.objectContaining({ week: dates.weekStart, total: 1, completed: 1 }),
    ]);
    expect(time.body.data).toEqual(
      expect.arrayContaining([
        { type: "DEVELOPMENT", totalMinutes: 75 },
        { type: "TESTING", totalMinutes: 45 },
      ]),
    );
    expect(activity.body.data).toHaveLength(1);
    expect(activity.body.data[0]).toMatchObject({
      action: "APPROVED",
      report: { id: reportId },
    });
    expect(approvedRoster.body).toMatchObject({
      data: [expect.objectContaining({ userId: member.id, status: "APPROVED" })],
      meta: { total: 1 },
    });
    await request(http)
      .get("/api/v1/manager/dashboard/task-trends")
      .query({ weeks: 0 })
      .set(auth("manager"))
      .expect(400);
    await request(http)
      .get("/api/v1/manager/dashboard/summary")
      .query({ weekStart: "2026-09-07", weekEnd: "2026-08-31" })
      .set(auth("manager"))
      .expect(400);
  });

  it("supports project clearing and corrections retaining archived projects", async () => {
    const created = await request(http)
      .post("/api/v1/reports")
      .set(auth("other"))
      .send({ ...dates, projectId: project.id, tasks: [task] })
      .expect(201);
    const id = created.body.data.id;
    const cleared = await request(http)
      .patch(`/api/v1/reports/${id}`)
      .set(auth("other"))
      .send({ projectId: null })
      .expect(200);
    expect(cleared.body.data.projectId).toBeNull();
    await request(http)
      .post(`/api/v1/reports/${id}/submit`)
      .set(auth("other"))
      .expect(400);
    await request(http)
      .patch(`/api/v1/reports/${id}`)
      .set(auth("other"))
      .send({ projectId: project.id })
      .expect(200);
    await request(http)
      .delete(`/api/v1/projects/${project.id}`)
      .set(auth("manager"))
      .expect(200);
    await request(http)
      .patch(`/api/v1/reports/${id}`)
      .set(auth("other"))
      .send({ projectId: project.id, notes: "Still editable" })
      .expect(200);
    const workload = await request(http)
      .get("/api/v1/manager/dashboard/project-workload")
      .query(dates)
      .set(auth("manager"))
      .expect(200);
    expect(workload.body.data[0].projectName).toContain("(archived)");
    expect(workload.body.data[0].reportCount).toBe(1);
  });

  it("issues unique real refresh tokens, rejects replay, and logs out", async () => {
    const credentials = { email: member.email, password: "password123" };
    const first = await request(http)
      .post("/api/v1/auth/login")
      .send(credentials)
      .expect(200);
    const second = await request(http)
      .post("/api/v1/auth/login")
      .send(credentials)
      .expect(200);
    const cookie = (response) =>
      response.headers["set-cookie"][0].split(";")[0];
    expect(cookie(first)).not.toBe(cookie(second));
    expect(first.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(first.body.data.refreshToken).toBeUndefined();
    const rotated = await request(http)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie(first))
      .set(AUTH_SETTINGS.csrfHeaderName, AUTH_SETTINGS.csrfHeaderValue)
      .expect(200);
    expect(cookie(rotated)).not.toBe(cookie(first));
    await request(http)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie(first))
      .set(AUTH_SETTINGS.csrfHeaderName, AUTH_SETTINGS.csrfHeaderValue)
      .expect(401);
    await request(http)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie(rotated))
      .set(AUTH_SETTINGS.csrfHeaderName, AUTH_SETTINGS.csrfHeaderValue)
      .expect(200);
    await request(http)
      .post("/api/v1/auth/refresh")
      .set("Cookie", cookie(rotated))
      .set(AUTH_SETTINGS.csrfHeaderName, AUTH_SETTINGS.csrfHeaderValue)
      .expect(401);
  });

  it("rechecks editability after waiting for a concurrent transition row lock", async () => {
    const draft = await prisma.report.findFirstOrThrow({
      where: { userId: other.id },
    });
    let locked, release;
    const acquired = new Promise((resolve) => {
      locked = resolve;
    });
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const transition = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM reports WHERE id = ${draft.id} FOR UPDATE`;
      locked();
      await gate;
      await tx.report.update({
        where: { id: draft.id },
        data: { status: "SUBMITTED" },
      });
    });
    await acquired;
    const editing = app
      .get(ReportsService)
      .update(draft.id, other.id, {
        notes: "Must not overwrite submitted content",
      });
    const rejected = expect(editing).rejects.toMatchObject({ status: 403 });
    release();
    await transition;
    await rejected;
    expect(
      (await prisma.report.findUnique({ where: { id: draft.id } })).notes,
    ).toBe("Still editable");
  });

  it("seeds complete version histories and an admin idempotently on the migrated database", async () => {
    const { execFileSync } = require("node:child_process");
    const path = require("node:path");
    for (let index = 0; index < 2; index++)
      execFileSync(
        process.execPath,
        ["-r", "ts-node/register", "prisma/seed.ts"],
        { cwd: path.resolve(__dirname, ".."), env: process.env, stdio: "pipe" },
      );
    expect(
      (await prisma.user.findUnique({ where: { email: "admin@example.com" } }))
        .role,
    ).toBe("ADMIN");
    const demo = await prisma.report.findMany({
      where: {
        user: {
          email: {
            in: [
              "kasun@example.com",
              "ayesha@example.com",
              "mohamed@example.com",
              "nimal@example.com",
            ],
          },
        },
      },
      include: { versions: true },
    });
    expect(demo).toHaveLength(16);
    for (const report of demo) {
      expect(report.latestVersionNumber).toBe(
        Math.max(0, ...report.versions.map((version) => version.versionNumber)),
      );
      for (const version of report.versions)
        expect(version.snapshotJson.nextWeekTasks).toHaveLength(3);
    }
    expect(
      demo.find((report) => report.status === "APPROVED").versions,
    ).toHaveLength(2);
  });
});
