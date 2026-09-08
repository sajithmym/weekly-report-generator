import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ReportStatus, ReviewAction } from "../common/enums";
import { lockReport } from "./report-lock";
import { REPORT_SETTINGS } from "../settings";

type SnapshotReport = Prisma.ReportGetPayload<{
  include: {
    tasks: true;
    nextWeekTasks: true;
    blockers: true;
    achievements: true;
    workHours: true;
    project: true;
  };
}>;

@Injectable()
export class ReportWorkflowService {
  constructor(private prisma: PrismaService) {}

  /**
   * Submit a report (DRAFT or NEEDS_CORRECTION → SUBMITTED)
   */
  async submit(reportId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockReport(tx, reportId);
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          tasks: true,
          nextWeekTasks: { orderBy: { sortOrder: "asc" } },
          blockers: true,
          achievements: true,
          workHours: true,
          project: true,
        },
      });

      if (!report)
        throw new NotFoundException(REPORT_SETTINGS.messages.reportNotFound);
      if (report.userId !== userId)
        throw new ForbiddenException(
          REPORT_SETTINGS.messages.reportOwnershipDenied,
        );
      if (
        !REPORT_SETTINGS.editableStatuses.includes(
          report.status as ReportStatus.DRAFT | ReportStatus.NEEDS_CORRECTION,
        )
      ) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.cannotSubmitInStatus(
            report.status as ReportStatus,
          ),
        );
      }
      if (report.tasks.length < REPORT_SETTINGS.minTasksForSubmission) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.reportRequiresTask,
        );
      }

      if (!report.projectId)
        throw new BadRequestException(
          REPORT_SETTINGS.messages.projectRequiredForSubmission,
        );
      if (!report.project?.isActive)
        throw new BadRequestException(REPORT_SETTINGS.messages.inactiveProject);
      if (report.tasks.some((task) => !task.taskName.trim()))
        throw new BadRequestException(REPORT_SETTINGS.messages.blankTaskName);

      const nextVersion = report.latestVersionNumber + 1;
      const transitioned = await tx.report.updateMany({
        where: {
          id: reportId,
          userId,
          latestVersionNumber: report.latestVersionNumber,
          status: { in: [...REPORT_SETTINGS.editableStatuses] },
        },
        data: {
          status: ReportStatus.SUBMITTED,
          latestVersionNumber: nextVersion,
          submittedAt: new Date(),
        },
      });
      if (transitioned.count !== 1) {
        throw new BadRequestException(REPORT_SETTINGS.messages.reportReadOnly);
      }

      await tx.reportVersion.create({
        data: {
          reportId,
          versionNumber: nextVersion,
          snapshotJson: this.createSnapshot(report),
          createdById: userId,
        },
      });

      return tx.report.findUniqueOrThrow({ where: { id: reportId } });
    });
  }

  /**
   * Manager requests changes (SUBMITTED → NEEDS_CORRECTION)
   */
  async requestChanges(reportId: string, reviewerId: string, comment: string) {
    const normalizedComment = comment?.trim();
    if (!normalizedComment) {
      throw new BadRequestException(REPORT_SETTINGS.messages.commentRequired);
    }

    return this.prisma.$transaction(async (tx) => {
      await lockReport(tx, reportId);
      const report = await tx.report.findUnique({ where: { id: reportId } });
      if (!report)
        throw new NotFoundException(REPORT_SETTINGS.messages.reportNotFound);
      if (report.status !== ReportStatus.SUBMITTED) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.reportMustBeSubmitted,
        );
      }

      const version = await tx.reportVersion.findFirst({
        where: { reportId, versionNumber: report.latestVersionNumber },
      });

      if (!version)
        throw new BadRequestException("The submitted version is missing.");
      const transitioned = await tx.report.updateMany({
        where: { id: reportId, status: ReportStatus.SUBMITTED },
        data: { status: ReportStatus.NEEDS_CORRECTION },
      });
      if (transitioned.count !== 1) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.reportMustBeSubmitted,
        );
      }

      await tx.review.create({
        data: {
          reportId,
          reportVersionId: version.id,
          reviewerId,
          action: ReviewAction.CHANGES_REQUESTED,
          comment: normalizedComment,
        },
      });

      return tx.report.findUniqueOrThrow({ where: { id: reportId } });
    });
  }

  /**
   * Manager approves report (SUBMITTED → APPROVED)
   */
  async approve(reportId: string, reviewerId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockReport(tx, reportId);
      const report = await tx.report.findUnique({ where: { id: reportId } });
      if (!report)
        throw new NotFoundException(REPORT_SETTINGS.messages.reportNotFound);
      if (report.status !== ReportStatus.SUBMITTED) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.reportMustBeSubmitted,
        );
      }

      const version = await tx.reportVersion.findFirst({
        where: { reportId, versionNumber: report.latestVersionNumber },
      });

      if (!version)
        throw new BadRequestException("The submitted version is missing.");
      const transitioned = await tx.report.updateMany({
        where: { id: reportId, status: ReportStatus.SUBMITTED },
        data: { status: ReportStatus.APPROVED, approvedAt: new Date() },
      });
      if (transitioned.count !== 1) {
        throw new BadRequestException(
          REPORT_SETTINGS.messages.reportMustBeSubmitted,
        );
      }

      await tx.review.create({
        data: {
          reportId,
          reportVersionId: version.id,
          reviewerId,
          action: ReviewAction.APPROVED,
        },
      });

      return tx.report.findUniqueOrThrow({ where: { id: reportId } });
    });
  }

  /**
   * Get version history for a report
   */
  async getVersionHistory(reportId: string) {
    return this.prisma.reportVersion.findMany({
      where: { reportId },
      include: {
        createdBy: { select: { id: true, name: true } },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { versionNumber: "desc" },
    });
  }

  private createSnapshot(report: SnapshotReport) {
    return {
      id: report.id,
      userId: report.userId,
      projectId: report.projectId,
      projectName: report.project?.name || null,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      status: ReportStatus.SUBMITTED,
      notes: report.notes,
      tasks: report.tasks,
      nextWeekTasks: report.nextWeekTasks,
      blockers: report.blockers,
      achievements: report.achievements,
      workHours: report.workHours,
    };
  }
}
