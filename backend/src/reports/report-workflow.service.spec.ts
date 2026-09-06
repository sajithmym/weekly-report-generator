import { ReportStatus, ReviewAction } from "../common/enums";
import { ReportWorkflowService } from "./report-workflow.service";

describe("ReportWorkflowService", () => {
  const report = (overrides: Record<string, unknown> = {}) => ({
    id: "report-1",
    userId: "member-1",
    projectId: "project-1",
    status: ReportStatus.DRAFT,
    latestVersionNumber: 0,
    submittedAt: null,
    approvedAt: null,
    notes: "Weekly update",
    tasks: [{ id: "task-1", taskName: "Deliver feature", status: "DONE" }],
    nextWeekTasks: [],
    blockers: [],
    achievements: [],
    workHours: [],
    project: { id: "project-1", name: "Client Portal" },
    ...overrides,
  });

  const createService = () => {
    const transaction = {
      $queryRaw: jest.fn(),
      report: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      reportVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      review: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      reportVersion: { findMany: jest.fn() },
    };
    return {
      service: new ReportWorkflowService(prisma as never),
      prisma,
      transaction,
    };
  };

  it("submits an editable report, persists an immutable snapshot, and increments its version", async () => {
    const { service, transaction } = createService();
    const draft = report();
    const submitted = {
      ...draft,
      status: ReportStatus.SUBMITTED,
      latestVersionNumber: 1,
    };
    transaction.report.findUnique.mockResolvedValue(draft);
    transaction.report.updateMany.mockResolvedValue({ count: 1 });
    transaction.reportVersion.create.mockResolvedValue({ id: "version-1" });
    transaction.report.findUniqueOrThrow.mockResolvedValue(submitted);

    await expect(service.submit(draft.id, draft.userId)).resolves.toBe(submitted);

    expect(transaction.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: draft.id,
          userId: draft.userId,
          latestVersionNumber: 0,
        }),
        data: expect.objectContaining({
          status: ReportStatus.SUBMITTED,
          latestVersionNumber: 1,
        }),
      }),
    );
    expect(transaction.reportVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reportId: draft.id,
        versionNumber: 1,
        createdById: draft.userId,
        snapshotJson: expect.objectContaining({
          status: ReportStatus.SUBMITTED,
          id: draft.id,
          projectName: "Client Portal",
          tasks: draft.tasks,
        }),
      }),
    });
  });

  it.each([
    [undefined, "member-1", "Report not found"],
    [report(), "another-member", "You can only edit your own reports"],
    [
      report({ status: ReportStatus.APPROVED }),
      "member-1",
      "Cannot submit report in APPROVED status",
    ],
    [report({ tasks: [] }), "member-1", "Add at least one named task before submitting."],
    [report({ projectId: null }), "member-1", "Select a project before submitting."],
    [
      report({ tasks: [{ taskName: "   ", status: "DONE" }] }),
      "member-1",
      "Task names cannot be blank.",
    ],
  ])("rejects invalid submission state %#", async (storedReport, userId, message) => {
    const { service, transaction } = createService();
    transaction.report.findUnique.mockResolvedValue(storedReport);

    await expect(service.submit("report-1", userId)).rejects.toThrow(message);
    expect(transaction.report.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale submission after the compare-and-transition update", async () => {
    const { service, transaction } = createService();
    transaction.report.findUnique.mockResolvedValue(report());
    transaction.report.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.submit("report-1", "member-1")).rejects.toThrow(
      "Report is not editable in current status",
    );
    expect(transaction.reportVersion.create).not.toHaveBeenCalled();
  });

  it("requests changes only for the latest submitted version", async () => {
    const { service, transaction } = createService();
    transaction.report.findUnique.mockResolvedValue(
      report({ status: ReportStatus.SUBMITTED, latestVersionNumber: 2 }),
    );
    transaction.reportVersion.findFirst.mockResolvedValue({ id: "version-2" });
    transaction.report.updateMany.mockResolvedValue({ count: 1 });
    transaction.review.create.mockResolvedValue({ id: "review-1" });
    transaction.report.findUniqueOrThrow.mockResolvedValue(
      report({ status: ReportStatus.NEEDS_CORRECTION, latestVersionNumber: 2 }),
    );

    await expect(
      service.requestChanges("report-1", "manager-1", "Please add detail."),
    ).resolves.toMatchObject({ status: ReportStatus.NEEDS_CORRECTION });
    expect(transaction.review.create).toHaveBeenCalledWith({
      data: {
        reportId: "report-1",
        reportVersionId: "version-2",
        reviewerId: "manager-1",
        action: ReviewAction.CHANGES_REQUESTED,
        comment: "Please add detail.",
      },
    });
  });

  it.each(["", "   "])("requires a non-blank correction comment", async (comment) => {
    const { service, transaction } = createService();

    await expect(
      service.requestChanges("report-1", "manager-1", comment),
    ).rejects.toThrow("Comment is required when requesting changes");
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
  });

  it("approves only a submitted report with its current version", async () => {
    const { service, transaction } = createService();
    transaction.report.findUnique.mockResolvedValue(
      report({ status: ReportStatus.SUBMITTED, latestVersionNumber: 3 }),
    );
    transaction.reportVersion.findFirst.mockResolvedValue({ id: "version-3" });
    transaction.report.updateMany.mockResolvedValue({ count: 1 });
    transaction.report.findUniqueOrThrow.mockResolvedValue(
      report({ status: ReportStatus.APPROVED, latestVersionNumber: 3 }),
    );

    await expect(service.approve("report-1", "manager-1")).resolves.toMatchObject({
      status: ReportStatus.APPROVED,
    });
    expect(transaction.review.create).toHaveBeenCalledWith({
      data: {
        reportId: "report-1",
        reportVersionId: "version-3",
        reviewerId: "manager-1",
        action: ReviewAction.APPROVED,
      },
    });
  });

  it("rejects a review transition when the report is not submitted or its version is absent", async () => {
    const { service, transaction } = createService();
    transaction.report.findUnique.mockResolvedValue(report());

    await expect(service.approve("report-1", "manager-1")).rejects.toThrow(
      "Report is not in SUBMITTED status",
    );

    transaction.report.findUnique.mockResolvedValue(
      report({ status: ReportStatus.SUBMITTED }),
    );
    transaction.reportVersion.findFirst.mockResolvedValue(null);
    await expect(service.approve("report-1", "manager-1")).rejects.toThrow(
      "The submitted version is missing.",
    );
  });

  it("loads version history in reverse version order with its reviewer relationships", async () => {
    const { service, prisma } = createService();
    const history = [{ id: "version-2", versionNumber: 2 }];
    prisma.reportVersion.findMany.mockResolvedValue(history);

    await expect(service.getVersionHistory("report-1")).resolves.toBe(history);
    expect(prisma.reportVersion.findMany).toHaveBeenCalledWith({
      where: { reportId: "report-1" },
      include: {
        createdBy: { select: { id: true, name: true } },
        reviews: { include: { reviewer: { select: { id: true, name: true } } } },
      },
      orderBy: { versionNumber: "desc" },
    });
  });
});
