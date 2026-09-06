import { DashboardService } from "./dashboard.service";

describe("DashboardService", () => {
  const weekStart = new Date("2026-08-31T00:00:00.000Z");

  const createService = () => {
    const prisma = {
      user: { findMany: jest.fn() },
      report: { findMany: jest.fn() },
      blocker: { count: jest.fn() },
      project: { findMany: jest.fn() },
      workHour: { groupBy: jest.fn() },
      review: { findMany: jest.fn() },
    };
    return { service: new DashboardService(prisma as never), prisma };
  };

  it("builds a paginated roster without exposing draft report content", async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([
      { id: "member-a", name: "Asha" },
      { id: "member-b", name: "Ben" },
    ]);
    prisma.report.findMany.mockResolvedValue([
      {
        id: "draft-1",
        userId: "member-a",
        weekStart,
        status: "DRAFT",
        submittedAt: null,
        versions: [],
        notes: "This field is intentionally not selected by the service",
      },
      {
        id: "submitted-1",
        userId: "member-b",
        weekStart,
        status: "SUBMITTED",
        submittedAt: new Date("2026-09-01T12:00:00.000Z"),
        versions: [{ submittedAt: new Date("2026-09-01T12:00:00.000Z") }],
      },
    ]);

    const result = await service.getRoster({
      page: 1,
      limit: 1,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    });

    expect(result).toMatchObject({
      data: [
        {
          userId: "member-a",
          name: "Asha",
          status: "DRAFT",
          reportId: null,
          submitted: false,
        },
      ],
      meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
    expect(JSON.stringify(result)).not.toContain("intentionally not selected");
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ notes: expect.anything() }),
      }),
    );
  });

  it("shows SUBMITTED only in the report's own week and NOT_STARTED for other weeks", async () => {
    // Regression guard for "member submitted but manager sees NOT_STARTED":
    // the roster must key reports strictly by member and Monday week, so a
    // submitted Aug 24-30 report never leaks into the Aug 31-Sep 6 roster.
    const { service, prisma } = createService();
    const previousWeek = new Date("2026-08-24T00:00:00.000Z");
    prisma.user.findMany.mockResolvedValue([{ id: "member-a", name: "Asha" }]);
    prisma.report.findMany.mockResolvedValue([
      {
        id: "submitted-prev-week",
        userId: "member-a",
        weekStart: previousWeek,
        status: "SUBMITTED",
        submittedAt: new Date("2026-08-28T10:00:00.000Z"),
        versions: [{ submittedAt: new Date("2026-08-28T10:00:00.000Z") }],
      },
    ]);

    const result = await service.getRoster({
      page: 1,
      limit: 20,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        userId: "member-a",
        weekStart: weekStart.toISOString(),
        status: "NOT_STARTED",
        reportId: null,
        submitted: false,
      }),
    ]);
    // Reports outside the requested week must not be requested at all.
    expect(prisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: ["member-a"] },
          weekStart: { gte: weekStart, lt: new Date("2026-09-07T00:00:00.000Z") },
        }),
      }),
    );

    const previousWeekRoster = await service.getRoster({
      page: 1,
      limit: 20,
      weekStart: "2026-08-24",
      weekEnd: "2026-08-30",
    });
    expect(previousWeekRoster.data).toEqual([
      expect.objectContaining({
        userId: "member-a",
        weekStart: previousWeek.toISOString(),
        status: "SUBMITTED",
        submitted: true,
      }),
    ]);
  });

  it("filters roster entries by pending, late, and stored report states", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
    try {
      const { service, prisma } = createService();
      prisma.user.findMany.mockResolvedValue([
        { id: "member-a", name: "Asha" },
        { id: "member-b", name: "Ben" },
      ]);
      prisma.report.findMany.mockResolvedValue([
        {
          id: "approved-1",
          userId: "member-a",
          weekStart,
          status: "APPROVED",
          submittedAt: new Date("2026-09-08T00:00:00.000Z"),
          versions: [{ submittedAt: new Date("2026-09-08T00:00:00.000Z") }],
        },
      ]);

      await expect(
        service.getRoster({
          page: 1,
          limit: 20,
          status: "PENDING",
          weekStart: "2026-08-31",
          weekEnd: "2026-09-06",
        }),
      ).resolves.toMatchObject({
        data: [expect.objectContaining({ userId: "member-b", status: "NOT_STARTED" })],
        meta: { total: 1 },
      });
      await expect(
        service.getRoster({
          page: 1,
          limit: 20,
          status: "LATE",
          weekStart: "2026-08-31",
          weekEnd: "2026-09-06",
        }),
      ).resolves.toMatchObject({ meta: { total: 2 } });
      await expect(
        service.getRoster({
          page: 1,
          limit: 20,
          status: "APPROVED",
          weekStart: "2026-08-31",
          weekEnd: "2026-09-06",
        }),
      ).resolves.toMatchObject({
        data: [expect.objectContaining({ userId: "member-a", status: "APPROVED" })],
        meta: { total: 1 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("calculates summary and status distribution from roster rows and non-draft blockers", async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([
      { id: "member-a", name: "Asha" },
      { id: "member-b", name: "Ben" },
      { id: "member-c", name: "Chao" },
    ]);
    prisma.report.findMany.mockResolvedValue([
      {
        id: "approved-1",
        userId: "member-a",
        weekStart,
        status: "APPROVED",
        submittedAt: new Date("2026-09-01T00:00:00.000Z"),
        versions: [{ submittedAt: new Date("2026-09-01T00:00:00.000Z") }],
      },
      {
        id: "draft-1",
        userId: "member-b",
        weekStart,
        status: "DRAFT",
        submittedAt: null,
        versions: [],
      },
    ]);
    prisma.blocker.count.mockResolvedValue(2);

    await expect(
      service.getSummary("2026-08-31", "2026-09-06"),
    ).resolves.toMatchObject({
      totalReports: 2,
      submittedCount: 1,
      approvedCount: 1,
      draftCount: 1,
      notStartedCount: 1,
      pendingCount: 2,
      expectedCount: 3,
      totalTeamMembers: 3,
      openBlockers: 2,
      complianceRate: 33,
    });
    await expect(
      service.getStatusDistribution("2026-08-31", "2026-09-06"),
    ).resolves.toEqual([
      { status: "APPROVED", count: 1 },
      { status: "DRAFT", count: 1 },
      { status: "NOT_STARTED", count: 1 },
    ]);
  });

  it("aggregates task trends, project workload, work hours, and review activity", async () => {
    const { service, prisma } = createService();
    prisma.report.findMany.mockResolvedValue([
      {
        weekStart,
        tasks: [{ status: "DONE" }, { status: "IN_PROGRESS" }],
      },
    ]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        name: "Client Portal",
        isActive: false,
        reports: [
          { tasks: [{ actualMinutes: 40 }, { actualMinutes: 35 }] },
          { tasks: [{ actualMinutes: 25 }] },
        ],
      },
    ]);
    prisma.workHour.groupBy.mockResolvedValue([
      { type: "DEVELOPMENT", _sum: { minutes: 65 } },
      { type: "TESTING", _sum: { minutes: null } },
    ]);
    const review = {
      id: "review-1",
      action: "APPROVED",
      comment: null,
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      reviewer: { id: "manager-1", name: "Mina" },
      report: { id: "report-1", user: { id: "member-a", name: "Asha" } },
    };
    prisma.review.findMany.mockResolvedValue([review]);

    await expect(
      service.getTaskTrends(2, "2026-09-06"),
    ).resolves.toEqual([
      { week: "2026-08-24", total: 0, completed: 0 },
      { week: "2026-08-31", total: 2, completed: 1 },
    ]);
    await expect(
      service.getProjectWorkload("2026-08-31", "2026-09-06"),
    ).resolves.toEqual([
      {
        projectId: "project-1",
        projectName: "Client Portal (archived)",
        reportCount: 2,
        totalMinutes: 100,
      },
    ]);
    await expect(
      service.getTimeDistribution("2026-08-31", "2026-09-06"),
    ).resolves.toEqual([
      { type: "DEVELOPMENT", totalMinutes: 65 },
      { type: "TESTING", totalMinutes: 0 },
    ]);
    await expect(
      service.getRecentActivity(1, "2026-08-31", "2026-09-06"),
    ).resolves.toEqual([review]);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1, orderBy: { createdAt: "desc" } }),
    );
  });
});
