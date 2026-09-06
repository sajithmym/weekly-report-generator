"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useResource } from "@/lib/use-resource";
import { managerApi } from "@/services/manager.api";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useToast } from "@/components/ui/toast";
import {
  ReportContent,
  ReportHistory,
} from "@/features/reports/components/report-content";
import { formatDate, getErrorMessage } from "@/lib/utils";
import type { Report } from "@/types";
import { REPORT_STATUSES } from "@/constants";

export default function ManagerReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [approveConfirmationOpen, setApproveConfirmationOpen] = useState(false);
  const { toast } = useToast();

  const loader = useCallback(
    () => managerApi.getTeamReportById(params.id as string),
    [params.id],
  );
  const {
    data: report,
    loading,
    error,
    reload: fetchReport,
    invalidate,
  } = useResource(loader);

  const handleApprove = async () => {
    if (!report) return;
    setActionLoading(true);
    try {
      await managerApi.approve(report.id);
      toast({
        variant: "success",
        title: "Report approved",
        description: "The member can now view the completed review.",
      });
      setApproveConfirmationOpen(false);
      invalidate();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not approve report",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!report || !comment.trim()) return;
    setActionLoading(true);
    try {
      await managerApi.requestChanges(report.id, comment.trim());
      setComment("");
      setChangesDialogOpen(false);
      toast({
        variant: "success",
        title: "Changes requested",
        description: "The member can now edit and resubmit the report.",
      });
      invalidate();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not request changes",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !report) return <ErrorState message={error} onRetry={fetchReport} />;
  if (!report) return <ErrorState message="Report not found" />;

  const isReviewable = report.status === REPORT_STATUSES.SUBMITTED;

  return (
    <div className="space-y-6">
      <PageHeader
        refreshDisabled={actionLoading || changesDialogOpen || approveConfirmationOpen}
        title={`${report.user?.name || "Unknown"} — ${formatDate(report.weekStart)} — ${formatDate(report.weekEnd)}`}
        description={`Version ${report.latestVersionNumber} • ${report.project?.name || "No project"}`}
        action={<StatusBadge status={report.status} />}
      />

      {error && <ErrorState message={error} onRetry={fetchReport} />}
      <ReportContent content={report} />
      <ReportHistory report={report} />

      {isReviewable && (
        <Card>
          <CardHeader>
            <CardTitle>Review Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                onClick={() => setApproveConfirmationOpen(true)}
                disabled={actionLoading}
              >
                Approve report
              </Button>
              <Button
                variant="destructive"
                onClick={() => setChangesDialogOpen(true)}
                disabled={actionLoading}
              >
                Request changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" onClick={() => router.back()}>
        Back
      </Button>
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Explain what the team member needs to correct before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="comment">Manager feedback</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Be specific and actionable..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangesDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestChanges}
              disabled={actionLoading || !comment.trim()}
            >
              {actionLoading ? "Sending..." : "Request changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={approveConfirmationOpen}
        onOpenChange={setApproveConfirmationOpen}
        title="Approve this report?"
        description="Approval completes the workflow for the current submitted version."
        confirmLabel="Approve report"
        loading={actionLoading}
        onConfirm={handleApprove}
      />
    </div>
  );
}
