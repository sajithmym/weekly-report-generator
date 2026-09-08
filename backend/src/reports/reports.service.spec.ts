import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ReportStatus, UserRole } from "../common/enums";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  const dates = { weekStart: "2026-08-31", weekEnd: "2026-09-06" };

  const createService = () => {
    const transaction = {
      $queryRaw: jest.fn(),
      report: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      project: { findUnique: jest.fn() },
    };
    const prisma = {
      report: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
      },
      project: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    return { service: new ReportsService(prisma as never), prisma, transaction };
  };

  it("creates a draft with safe defaults and nested report content", async () => {
    const { service, prisma } = createService();
    const created = { id: "report-1", status: ReportStatus.DRAFT };
    prisma.report.findFirst.mockResolvedValue(null);
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      isActive: true,
    });
    prisma.report.create.mockResolvedValue(created);

    await expect(
      service.create("member-1", {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Deliver feature" }],
        nextWeekTasks: [{ description: "Follow up" }],
        blockers: [{ description: "Waiting" }],
        achievements: [{ description: "Shipped" }],
        workHours: [{ type: "DEVELOPMENT", minutes: 60 }],
      }),
    ).resolves.toBe(created);

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "member-1",
          status: ReportStatus.DRAFT,
          tasks: {
            create: [
              expect.objectContaining({
                taskName: "Deliver feature",
                priority: "MEDIUM",
                status: "TODO",
                plannedPercentage: 0,
                actualMinutes: 0,
              }),
            ],
          },
          nextWeekTasks: { create: [{ description: "Follow up", sortOrder: 0 }] },
          blockers: {
            create: [{ description: "Waiting", isKeyIssue: false, isResolved: false }],
          },
          achievements: { create: [{ description: "Shipped", isKeyAchievement: false }] },
          workHours: { create: [{ type: "DEVELOPMENT", minutes: 60 }] },
        }),
      }),
    );
  });

  it("creates an incomplete draft while leaving submission requirements to the workflow", async () => {
    const { service, prisma } = createService();
    const created = { id: "report-1", status: ReportStatus.DRAFT };
    prisma.report.findFirst.mockResolvedValue(null);
    prisma.report.create.mockResolvedValue(created);

    await expect(service.create("member-1", dates)).resolves.toBe(created);
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: undefined, tasks: undefined }),
      }),
    );
  });

  it.each([
    [
      {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Task" }],
        blockers: [{ description: "A", isKeyIssue: true }, { description: "B", isKeyIssue: true }],
      },
      "Only one blocker can be marked as the key issue",
    ],
    [
      {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Task" }],
        achievements: [
          { description: "A", isKeyAchievement: true },
          { description: "B", isKeyAchievement: true },
        ],
      },
      "Only one achievement can be marked as the key achievement",
    ],
  ])("rejects invalid key item combinations before persistence", async (dto, message) => {
    const { service, prisma } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      isActive: true,
    });

    await expect(service.create("member-1", dto)).rejects.toThrow(message);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate weekly reports and inactive or missing projects", async () => {
    const { service, prisma } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      isActive: true,
    });
    prisma.report.findFirst.mockResolvedValueOnce({ id: "existing" });
    await expect(
      service.create("member-1", {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Deliver feature" }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.report.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.project.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "project-1", isActive: false });
    await expect(
      service.create("member-1", {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Deliver feature" }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create("member-1", {
        ...dates,
        projectId: "project-1",
        tasks: [{ taskName: "Deliver feature" }],
      }),
    ).rejects.toThrow("Project is deactivated and cannot be used");
  });

  it("keeps drafts private and restricts team members to their own reports", async () => {
    const { service, prisma } = createService();
    const draft = { id: "report-1", userId: "owner", status: ReportStatus.DRAFT };
    prisma.report.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(draft).mockResolvedValueOnce({
      ...draft,
      status: ReportStatus.SUBMITTED,
    });

    await expect(
      service.findById("missing", "owner", UserRole.TEAM_MEMBER),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findById(draft.id, "manager", UserRole.MANAGER),
    ).rejects.toThrow("Draft contents are private to their author.");
    await expect(
      service.findById(draft.id, "another-member", UserRole.TEAM_MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("paginates private reports, summarizes status counts, and filters non-draft team reports", async () => {
    const { service, prisma } = createService();
    prisma.report.findMany.mockResolvedValue([{ id: "report-1" }]);
    prisma.report.count.mockResolvedValue(3);
    prisma.report.groupBy.mockResolvedValue([
      { status: ReportStatus.DRAFT, _count: 2 },
      { status: ReportStatus.APPROVED, _count: 1 },
    ]);

    await expect(
      service.findMyReports("member-1", { page: 2, limit: 1 }),
    ).resolves.toMatchObject({
      data: [{ id: "report-1" }],
      meta: { page: 2, limit: 1, total: 3, totalPages: 3 },
    });
    await expect(service.getMySummary("member-1")).resolves.toEqual({
      DRAFT: 2,
      APPROVED: 1,
    });

    await expect(
      service.findByFilters({ page: 1, limit: 20, status: ReportStatus.DRAFT }),
    ).resolves.toMatchObject({ data: [], meta: { total: 0 } });
    expect(prisma.report.findMany).toHaveBeenCalledTimes(1);

    prisma.report.findMany.mockResolvedValue([{ id: "report-2", status: ReportStatus.APPROVED }]);
    prisma.report.count.mockResolvedValue(1);
    await expect(
      service.findByFilters({
        page: 1,
        limit: 20,
        userId: "member-1",
        projectId: "project-1",
        status: ReportStatus.APPROVED,
        weekStart: dates.weekStart,
        weekEnd: dates.weekEnd,
      }),
    ).resolves.toMatchObject({ data: [{ id: "report-2" }], meta: { total: 1 } });
    expect(prisma.report.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "member-1",
          projectId: "project-1",
          status: ReportStatus.APPROVED,
        }),
      }),
    );
  });

  it("rejects an inverted manager reporting range", async () => {
    const { service } = createService();

    await expect(
      service.findByFilters({
        page: 1,
        limit: 20,
        weekStart: "2026-09-07",
        weekEnd: "2026-08-31",
      }),
    ).rejects.toThrow("Week end must be after or equal to week start");
  });

  it("locks a report before checking ownership and editability", async () => {
    const { service, transaction } = createService();
    transaction.report.findUnique
      .mockResolvedValueOnce({
        id: "report-1",
        userId: "owner",
        status: ReportStatus.DRAFT,
        weekStart: new Date("2026-08-31"),
        weekEnd: new Date("2026-09-06"),
      })
      .mockResolvedValueOnce({
        id: "report-2",
        userId: "member-1",
        status: ReportStatus.APPROVED,
        weekStart: new Date("2026-08-31"),
        weekEnd: new Date("2026-09-06"),
      });

    await expect(
      service.update("report-1", "member-1", { notes: "No access" }),
    ).rejects.toThrow("You can only edit your own reports");
    await expect(
      service.update("report-2", "member-1", { notes: "Locked" }),
    ).rejects.toThrow("Report is not editable in current status");
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(transaction.report.update).not.toHaveBeenCalled();
  });

  it("replaces supplied nested collections when an editable report is updated", async () => {
    const { service, transaction } = createService();
    const stored = {
      id: "report-1",
      userId: "member-1",
      projectId: "project-1",
      status: ReportStatus.NEEDS_CORRECTION,
      weekStart: new Date("2026-08-31"),
      weekEnd: new Date("2026-09-06"),
    };
    transaction.report.findUnique.mockResolvedValue(stored);
    transaction.report.findFirst.mockResolvedValue(null);
    transaction.report.update.mockResolvedValue({ id: stored.id, notes: "Revised" });

    await expect(
      service.update(stored.id, "member-1", {
        notes: "Revised",
        tasks: [{ taskName: "Replacement task", status: "DONE" }],
        blockers: [{ description: "Resolved", isResolved: true }],
      }),
    ).resolves.toMatchObject({ notes: "Revised" });
    expect(transaction.report.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: "Revised",
          tasks: {
            deleteMany: {},
            create: [expect.objectContaining({ taskName: "Replacement task", status: "DONE" })],
          },
          blockers: {
            deleteMany: {},
            create: [expect.objectContaining({ description: "Resolved", isResolved: true })],
          },
        }),
      }),
    );
  });
});
