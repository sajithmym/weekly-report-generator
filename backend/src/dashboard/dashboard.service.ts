import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { DAY_MS, selectedWeeks, weekOf } from "../reports/report-date";
import { PaginatedResponse } from "../common/dto";
import { ReportStatus, UserRole } from "../common/enums";
import { RosterFilterDto } from "./dto/dashboard-filter.dto";
import { DASHBOARD_SETTINGS, REPORT_SETTINGS } from "../settings";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private dateFilter(start?: string, end?: string): Prisma.ReportWhereInput {
    const range = selectedWeeks(start, end);
    return {
      weekStart: { gte: range.first, lt: range.endExclusive },
      status: { not: ReportStatus.DRAFT },
    };
  }

  private async roster(start?: string, end?: string, userId?: string) {
    const range = selectedWeeks(start, end);
    const members = await this.prisma.user.findMany({
      where: {
        role: UserRole.TEAM_MEMBER,
        isActive: true,
        ...(userId ? { id: userId } : {}),
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const reports = await this.prisma.report.findMany({
      where: {
        userId: { in: members.map((member) => member.id) },
        weekStart: { gte: range.first, lt: range.endExclusive },
      },
      // Draft tracking exposes status metadata only, never report content.
      select: {
        id: true,
        userId: true,
        weekStart: true,
        status: true,
        submittedAt: true,
        versions: {
          select: { submittedAt: true },
          orderBy: { versionNumber: "asc" },
          take: DASHBOARD_SETTINGS.firstSubmissionLimit,
        },
      },
    });
    const lookup = new Map(
      reports.map((report) => [
        `${report.userId}:${weekOf(report.weekStart).toISOString()}`,
        report,
      ]),
    );
    return members.flatMap((member) =>
      range.weeks.map((week) => {
        const report = lookup.get(`${member.id}:${week.toISOString()}`);
        const submittedAt =
          report?.versions[0]?.submittedAt || report?.submittedAt || null;
        const deadline = new Date(
          week.getTime() + REPORT_SETTINGS.calendar.daysPerWeek * DAY_MS,
        );
        const submitted =
          report !== undefined && report.status !== ReportStatus.DRAFT;
        const late = submitted
          ? Boolean(submittedAt && submittedAt >= deadline)
          : new Date() >= deadline;
        return {
          userId: member.id,
          name: member.name,
          weekStart: week.toISOString(),
          deadline: deadline.toISOString(),
          status:
            report?.status === ReportStatus.DRAFT
              ? ReportStatus.DRAFT
              : report?.status || REPORT_SETTINGS.rosterStates.notStarted,
          reportId:
            report?.status === ReportStatus.DRAFT ? null : report?.id || null,
          submittedAt: submittedAt?.toISOString() || null,
          submitted,
          late,
        };
      }),
    );
  }

  async getRoster(filters: RosterFilterDto) {
    let rows = await this.roster(
      filters.weekStart,
      filters.weekEnd,
      filters.userId,
    );
    if (filters.status === REPORT_SETTINGS.rosterStates.late)
      rows = rows.filter((row) => row.late);
    else if (filters.status === REPORT_SETTINGS.rosterStates.pending)
      rows = rows.filter((row) => !row.submitted);
    else if (filters.status)
      rows = rows.filter((row) => row.status === filters.status);
    return new PaginatedResponse(
      rows.slice(
        (filters.page - 1) * filters.limit,
        filters.page * filters.limit,
      ),
      rows.length,
      filters.page,
      filters.limit,
    );
  }

  async getSummary(start?: string, end?: string) {
    const rows = await this.roster(start, end);
    const submittedCount = rows.filter((row) => row.submitted).length;
    const openBlockers = await this.prisma.blocker.count({
      where: { isResolved: false, report: this.dateFilter(start, end) },
    });
    return {
      totalReports: rows.filter(
        (row) => row.status !== REPORT_SETTINGS.rosterStates.notStarted,
      ).length,
      submittedCount,
      approvedCount: rows.filter((row) => row.status === ReportStatus.APPROVED)
        .length,
      needsCorrectionCount: rows.filter(
        (row) => row.status === ReportStatus.NEEDS_CORRECTION,
      ).length,
      draftCount: rows.filter((row) => row.status === ReportStatus.DRAFT)
        .length,
      notStartedCount: rows.filter((row) => row.status === "NOT_STARTED")
        .length,
      pendingCount: rows.filter((row) => !row.submitted).length,
      lateCount: rows.filter((row) => row.late).length,
      expectedCount: rows.length,
      totalTeamMembers: new Set(rows.map((row) => row.userId)).size,
      openBlockers,
      complianceRate: rows.length
        ? Math.round((submittedCount / rows.length) * 100)
        : 0,
    };
  }

  async getStatusDistribution(start?: string, end?: string) {
    const rows = await this.roster(start, end);
    const counts = new Map<string, number>();
    rows.forEach((row) =>
      counts.set(row.status, (counts.get(row.status) || 0) + 1),
    );
    return Array.from(counts, ([status, count]) => ({ status, count }));
  }

  async getTaskTrends(weeks = 8, weekEnd?: string) {
    const last = weekOf(weekEnd || new Date());
    const start = new Date(
      last.getTime() -
        (weeks - 1) * REPORT_SETTINGS.calendar.daysPerWeek * DAY_MS,
    );
    const range = selectedWeeks(start.toISOString(), last.toISOString());
    const reports = await this.prisma.report.findMany({
      where: this.dateFilter(start.toISOString(), last.toISOString()),
      select: { weekStart: true, tasks: { select: { status: true } } },
    });
    return range.weeks.map((week) => {
      const tasks = reports
        .filter(
          (report) => weekOf(report.weekStart).getTime() === week.getTime(),
        )
        .flatMap((report) => report.tasks);
      return {
        week: week.toISOString().slice(0, 10),
        total: tasks.length,
        completed: tasks.filter(
          (task) => task.status === DASHBOARD_SETTINGS.completedTaskStatus,
        ).length,
      };
    });
  }

  async getProjectWorkload(start?: string, end?: string) {
    const projects = await this.prisma.project.findMany({
      where: { reports: { some: this.dateFilter(start, end) } },
      select: {
        id: true,
        name: true,
        isActive: true,
        reports: {
          where: this.dateFilter(start, end),
          select: { tasks: { select: { actualMinutes: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    return projects.map((project) => ({
      projectId: project.id,
      projectName: project.name + (project.isActive ? "" : " (archived)"),
      reportCount: project.reports.length,
      totalMinutes: project.reports.reduce(
        (sum, report) =>
          sum +
          report.tasks.reduce((total, task) => total + task.actualMinutes, 0),
        0,
      ),
    }));
  }

  async getTimeDistribution(start?: string, end?: string) {
    const hours = await this.prisma.workHour.groupBy({
      by: ["type"],
      where: { report: this.dateFilter(start, end) },
      _sum: { minutes: true },
    });
    return hours.map((hour) => ({
      type: hour.type,
      totalMinutes: hour._sum.minutes || 0,
    }));
  }

  async getRecentActivity(limit = 20, start?: string, end?: string) {
    const reviews = await this.prisma.review.findMany({
      take: limit,
      where: { report: this.dateFilter(start, end) },
      include: {
        reviewer: { select: { id: true, name: true } },
        report: {
          select: {
            id: true,
            weekStart: true,
            weekEnd: true,
            user: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return reviews.map((review) => ({
      id: review.id,
      action: review.action,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: review.reviewer,
      report: review.report,
    }));
  }
}
