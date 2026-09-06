"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { useResource } from "@/lib/use-resource";
import { reportsApi } from "@/services/reports.api";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { PAGINATION_SETTINGS } from "@/lib/settings";
import type { Report, PaginatedResponse } from "@/types";

export default function ReportHistoryPage() {
  const [page, setPage] = useState(1);

  const loader = useCallback(
    () =>
      reportsApi.getMyReports({
        page,
        limit: PAGINATION_SETTINGS.defaultLimit,
      }),
    [page],
  );
  const { data, loading, error, reload: fetchHistory } = useResource(loader);

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={fetchHistory} />;

  const reports = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report History"
        description="View all your past reports"
      />

      {error && <ErrorState message={error} onRetry={fetchHistory} />}
      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Your report history will appear here."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      Week of {formatDate(report.weekStart)} —{" "}
                      {formatDate(report.weekEnd)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {report.project?.name || "No project"} • Version{" "}
                      {report.latestVersionNumber}
                    </p>
                  </div>
                  <StatusBadge status={report.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}
    </div>
  );
}
