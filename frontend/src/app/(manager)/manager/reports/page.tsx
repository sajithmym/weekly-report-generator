"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";
import { SubmissionRoster } from "@/features/reports/components/submission-roster";
import { WeekStepper } from "@/features/reports/components/week-stepper";
import { reportWeek } from "@/lib/report-week";
import { useResource } from "@/lib/use-resource";
import { managerApi } from "@/services/manager.api";
import { EntityPicker } from "@/components/shared/entity-picker";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { REPORT_STATUSES, REPORT_STATUS_LABELS } from "@/constants";
import { PAGINATION_SETTINGS } from "@/lib/settings";
import type { PaginatedResponse, Project, Report, User } from "@/types";

type ReportFilters = {
  userId: string;
  projectId: string;
  status: string;
  weekStart: string;
  weekEnd: string;
};

const DEFAULT_FILTERS: ReportFilters = {
  userId: "",
  projectId: "",
  status: "",
  ...reportWeek(),
};

export default function ManagerReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState<number>(PAGINATION_SETTINGS.defaultPage);
  const [filterError, setFilterError] = useState<string | null>(null);

  const loader = useCallback(
    () =>
      managerApi.getTeamReports({
        page,
        limit: PAGINATION_SETTINGS.defaultLimit,
        userId: appliedFilters.userId || undefined,
        projectId: appliedFilters.projectId || undefined,
        status: appliedFilters.status || undefined,
        weekStart: appliedFilters.weekStart || undefined,
        weekEnd: appliedFilters.weekEnd || undefined,
      }),
    [page, appliedFilters],
  );
  const { data, loading, error, reload: fetchReports } = useResource(loader);

  const applyFilters = () => {
    if (
      filters.weekStart &&
      filters.weekEnd &&
      new Date(filters.weekEnd) < new Date(filters.weekStart)
    ) {
      setFilterError("Week end must be after or equal to week start.");
      return;
    }
    setFilterError(null);
    setPage(PAGINATION_SETTINGS.defaultPage);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilterError(null);
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(PAGINATION_SETTINGS.defaultPage);
  };

  const reports = data?.data || [];
  const hasFilters = Object.values(filters).some(Boolean);
  const rosterWeek = {
    weekStart: appliedFilters.weekStart || reportWeek().weekStart,
    weekEnd:
      appliedFilters.weekEnd ||
      appliedFilters.weekStart ||
      reportWeek().weekEnd,
  };
  // Development-only trace of the effective week sent to the roster endpoint.
  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[team-reports] roster week ${rosterWeek.weekStart}..${rosterWeek.weekEnd}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Reports"
        description="Find, review, and track reports across every team member and project."
      />
      <Card>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <FilterField label="Team member">
            <EntityPicker
              kind="member"
              value={filters.userId}
              emptyLabel="All members"
              onChange={(userId) => setFilters({ ...filters, userId })}
            />
          </FilterField>
          <FilterField label="Project">
            <EntityPicker
              kind="project"
              value={filters.projectId}
              includeArchived
              emptyLabel="All projects"
              onChange={(projectId) => setFilters({ ...filters, projectId })}
            />
          </FilterField>
          <FilterField label="Report status">
            <Select
              value={filters.status || "ALL"}
              onValueChange={(status) =>
                setFilters({
                  ...filters,
                  status: status === "ALL" ? "" : status,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.values(REPORT_STATUSES)
                  .filter((status) => status !== REPORT_STATUSES.DRAFT)
                  .map((status) => (
                    <SelectItem key={status} value={status}>
                      {REPORT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Week start">
            <DatePicker
              value={filters.weekStart}
              onChange={(weekStart) =>
                setFilters({ ...filters, weekStart: weekStart || "" })
              }
              placeholder="From date"
            />
          </FilterField>
          <FilterField label="Week end">
            <DatePicker
              value={filters.weekEnd}
              onChange={(weekEnd) =>
                setFilters({ ...filters, weekEnd: weekEnd || "" })
              }
              placeholder="To date"
            />
          </FilterField>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={applyFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetFilters}
              disabled={!hasFilters}
              aria-label="Reset filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          {filterError && (
            <p className="text-sm text-destructive lg:col-span-3 xl:col-span-6">
              {filterError}
            </p>
          )}
        </CardContent>
      </Card>
      <WeekStepper
        weekStart={rosterWeek.weekStart}
        weekEnd={rosterWeek.weekEnd}
        onChange={(weekStart) => {
          const week = reportWeek(weekStart);
          setFilters((current) => ({ ...current, ...week }));
          setAppliedFilters((current) => ({ ...current, ...week }));
          setPage(PAGINATION_SETTINGS.defaultPage);
        }}
      />
      <SubmissionRoster
        key={`${rosterWeek.weekStart}:${rosterWeek.weekEnd}`}
        weekStart={rosterWeek.weekStart}
        weekEnd={rosterWeek.weekEnd}
      />
      {loading ? (
        <LoadingState message="Loading team reports..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchReports} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports found"
          description={
            hasFilters
              ? "No reports match the selected filters. Try widening your search."
              : "No team reports have been created yet."
          }
          action={
            hasFilters ? (
              <Button variant="outline" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.meta.total || 0} report{data?.meta.total === 1 ? "" : "s"}{" "}
              found
            </span>
            <span>
              Page {data?.meta.page} of {data?.meta.totalPages}
            </span>
          </div>
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/manager/reports/${report.id}`}
                className="block"
              >
                <Card className="cursor-pointer">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {report.user?.name || "Unknown member"}
                        </p>
                        {report.latestVersionNumber > 0 && (
                          <Badge variant="secondary">
                            Version {report.latestVersionNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Week of {formatDate(report.weekStart)} —{" "}
                        {formatDate(report.weekEnd)} ·{" "}
                        {report.project?.name || "No project"}
                      </p>
                    </div>
                    <StatusBadge status={report.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {(data?.meta.totalPages || 0) > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setPage((current) => current - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data?.meta.page} of {data?.meta.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= (data?.meta.totalPages || 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
