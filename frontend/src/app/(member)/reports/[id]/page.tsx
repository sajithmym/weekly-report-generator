"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useResource } from "@/lib/use-resource";
import { reportsApi } from "@/services/reports.api";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ReportContent,
  ReportHistory,
} from "@/features/reports/components/report-content";
import { formatDate, getErrorMessage } from "@/lib/utils";
import type { Report } from "@/types";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useToast } from "@/components/ui/toast";
import { REPORT_STATUSES } from "@/constants";

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const { toast } = useToast();

  const loader = useCallback(
    () => reportsApi.getById(params.id as string),
    [params.id],
  );
  const {
    data: report,
    loading,
    error,
    reload: fetchReport,
    invalidate,
  } = useResource(loader);

  const handleSubmit = async () => {
    if (!report) return;
    setSubmitting(true);
    try {
      await reportsApi.submit(report.id);
      toast({
        variant: "success",
        title: "Report submitted",
        description: "A version snapshot was created for manager review.",
      });
      setShowSubmitConfirmation(false);
      invalidate();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not submit report",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !report) return <ErrorState message={error} onRetry={fetchReport} />;
  if (!report) return <ErrorState message="Report not found" />;

  const isEditable =
    report.status === REPORT_STATUSES.DRAFT ||
    report.status === REPORT_STATUSES.NEEDS_CORRECTION;

  return (
    <div className="space-y-6">
      <PageHeader
        refreshDisabled={submitting || showSubmitConfirmation}
        title={`Report: ${formatDate(report.weekStart)} — ${formatDate(report.weekEnd)}`}
        description={`Version ${report.latestVersionNumber}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            {isEditable && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/reports/${report.id}/edit`)}
                >
                  Edit report
                </Button>
                <Button
                  onClick={() => setShowSubmitConfirmation(true)}
                  disabled={submitting}
                >
                  Submit report
                </Button>
              </>
            )}
          </div>
        }
      />

      {report.status === REPORT_STATUSES.NEEDS_CORRECTION && report.reviews?.[0]?.comment && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-amber-950">Manager feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-950">
              {report.reviews[0].comment}
            </p>
            <p className="mt-2 text-xs text-amber-800">
              Requested by {report.reviews[0].reviewer?.name || "your manager"}{" "}
              on {formatDate(report.reviews[0].createdAt)}
            </p>
          </CardContent>
        </Card>
      )}

      {error && <ErrorState message={error} onRetry={fetchReport} />}
      <ReportContent content={report} />
      <ReportHistory report={report} />

      <Button variant="outline" onClick={() => router.back()}>
        Back
      </Button>
      <ConfirmationDialog
        open={showSubmitConfirmation}
        onOpenChange={setShowSubmitConfirmation}
        title="Submit this report?"
        description="Submitting creates an immutable version and makes the report read-only until a manager requests changes."
        confirmLabel="Submit report"
        loading={submitting}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
