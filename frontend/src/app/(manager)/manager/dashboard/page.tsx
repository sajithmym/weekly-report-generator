"use client";

import { useCallback, useState } from "react";
import { reportWeek } from "@/lib/report-week";
import { useResource } from "@/lib/use-resource";
import { DatePicker } from "@/components/ui/date-picker";
import { SubmissionRoster } from "@/features/reports/components/submission-roster";
import { WeekStepper } from "@/features/reports/components/week-stepper";
import { managerApi } from "@/services/manager.api";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/utils";
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Users,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type {
  DashboardSummary,
  StatusDistribution,
  TaskTrend,
  ProjectWorkload,
  TimeDistribution,
  ActivityItem,
} from "@/types";
import { CHART_SETTINGS, DASHBOARD_SETTINGS } from "@/lib/settings";
import { REVIEW_ACTIONS } from "@/constants";

const COLORS = CHART_SETTINGS.palette;

export default function ManagerDashboardPage() {
  const [week, setWeek] = useState(() => reportWeek());
  const loader = useCallback(async () => {
    const [
      summary,
      statusDist,
      taskTrends,
      projectWorkload,
      timeDist,
      activity,
    ] = await Promise.all([
      managerApi.getSummary(week.weekStart, week.weekEnd),
      managerApi.getStatusDistribution(week.weekStart, week.weekEnd),
      managerApi.getTaskTrends(DASHBOARD_SETTINGS.taskTrendWeeks, week.weekEnd),
      managerApi.getProjectWorkload(week.weekStart, week.weekEnd),
      managerApi.getTimeDistribution(week.weekStart, week.weekEnd),
      managerApi.getRecentActivity(
        DASHBOARD_SETTINGS.recentActivityLimit,
        week.weekStart,
        week.weekEnd,
      ),
    ]);
    return {
      summary,
      statusDist,
      taskTrends,
      projectWorkload,
      timeDist,
      activity,
    };
  }, [week]);
  const { data, loading, error, reload: fetchDashboard } = useResource(loader);
  const {
    summary,
    statusDist = [],
    taskTrends = [],
    projectWorkload = [],
    timeDist = [],
    activity = [],
  } = data || {};

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error && !data) return <ErrorState message={error} onRetry={fetchDashboard} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manager Dashboard"
        description="Team overview and analytics"
      />

      {error && <ErrorState message={error} onRetry={fetchDashboard} />}
      <div className="max-w-sm space-y-2">
        <p id="dashboard-week-label" className="text-sm font-medium">
          Reporting week (Monday–Sunday, UTC)
        </p>
        <DatePicker
          value={week.weekStart}
          onChange={(value) => value && setWeek(reportWeek(value))}
        />
        <p className="text-sm text-muted-foreground">
          {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}
        </p>
      </div>
      <WeekStepper
        weekStart={week.weekStart}
        weekEnd={week.weekEnd}
        onChange={(weekStart) => setWeek(reportWeek(weekStart))}
      />
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        <MetricCard
          title="Reports Submitted"
          value={summary?.submittedCount || 0}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          title="Compliance"
          value={`${summary?.complianceRate || 0}%`}
        />
        <MetricCard title="Pending" value={summary?.pendingCount || 0} />
        <MetricCard title="Late" value={summary?.lateCount || 0} />
        <MetricCard title="Not started" value={summary?.notStartedCount || 0} />
        <MetricCard
          title="Approved"
          value={summary?.approvedCount || 0}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <MetricCard
          title="Needs Correction"
          value={summary?.needsCorrectionCount || 0}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MetricCard
          title="Team Members"
          value={summary?.totalTeamMembers || 0}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Open Blockers"
          value={summary?.openBlockers || 0}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      <SubmissionRoster
        key={week.weekStart}
        weekStart={week.weekStart}
        weekEnd={week.weekEnd}
      />
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_SETTINGS.height}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, count }) => `${status}: ${count}`}
                    outerRadius={CHART_SETTINGS.pieOuterRadius}
                    fill={CHART_SETTINGS.projectReports}
                    dataKey="count"
                    nameKey="status"
                  >
                    {statusDist.map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Task Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Task Completion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {taskTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_SETTINGS.height}>
                <BarChart data={taskTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="total"
                    fill={CHART_SETTINGS.taskTotal}
                    name="Total"
                  />
                  <Bar
                    dataKey="completed"
                    fill={CHART_SETTINGS.taskCompleted}
                    name="Completed"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Project Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Project Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {projectWorkload.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_SETTINGS.height}>
                <BarChart data={projectWorkload}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="projectName" />
                  <YAxis yAxisId="reports" allowDecimals={false} />
                  <YAxis yAxisId="minutes" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="reports"
                    dataKey="reportCount"
                    fill={CHART_SETTINGS.projectReports}
                    name="Reports"
                  />
                  <Bar
                    yAxisId="minutes"
                    dataKey="totalMinutes"
                    fill={CHART_SETTINGS.projectMinutes}
                    name="Minutes"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>

        {/* Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {timeDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_SETTINGS.height}>
                <PieChart>
                  <Pie
                    data={timeDist}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, totalMinutes }) =>
                      `${type}: ${formatMinutes(totalMinutes)}`
                    }
                    outerRadius={CHART_SETTINGS.pieOuterRadius}
                    fill={CHART_SETTINGS.projectReports}
                    dataKey="totalMinutes"
                    nameKey="type"
                  >
                    {timeDist.map((entry, index) => (
                      <Cell
                        key={entry.type}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 border rounded-md"
                >
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{item.reviewer.name}</span>{" "}
                      {item.action === REVIEW_ACTIONS.APPROVED
                        ? "approved"
                        : "requested changes on"}{" "}
                      <span className="font-medium">
                        {item.report.user.name}&apos;s
                      </span>{" "}
                      report
                      {item.report.project && (
                        <span> for {item.report.project.name}</span>
                      )}
                    </p>
                    {item.comment && (
                      <p className="text-sm text-muted-foreground mt-1">
                        &quot;{item.comment}&quot;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No recent activity
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
