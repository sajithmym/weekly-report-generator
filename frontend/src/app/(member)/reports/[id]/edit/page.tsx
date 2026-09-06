"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useResource } from "@/lib/use-resource";
import { reportsApi } from "@/services/reports.api";
import { WeeklyReportForm } from "@/features/reports/components/weekly-report-form";
import type { ReportFormData } from "@/features/reports/schemas/report.schema";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { useToast } from "@/components/ui/toast";
import type { Report } from "@/types";
import { REPORT_STATUSES } from "@/constants";
import { getErrorMessage } from "@/lib/utils";

export default function EditReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loader = useCallback(() => reportsApi.getById(id), [id]);
  const {
    data: report,
    loading,
    error,
    reload: fetchReport,
  } = useResource(loader);
  const save = async (data: ReportFormData) => {
    setSaving(true);
    try {
      await reportsApi.update(id, data);
      toast({
        variant: "success",
        title: "Draft saved",
        description: "Your changes are ready for submission.",
      });
      router.push(`/reports/${id}`);
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not save report",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <LoadingState message="Loading report editor..." />;
  if (error && !report) return <ErrorState message={error} onRetry={fetchReport} />;
  if (!report) return <ErrorState message="Report not found" />;
  if (
    report.status !== REPORT_STATUSES.DRAFT &&
    report.status !== REPORT_STATUSES.NEEDS_CORRECTION
  )
    return (
      <ErrorState message="This report is read-only and can no longer be edited." />
    );
  return (
    <div className="space-y-6">
      <PageHeader
        refreshDisabled={saving || dirty}
        refreshDisabledReason={dirty ? "Save or cancel your changes before refreshing." : "Saving report..."}
        title="Edit weekly report"
        description="Update the draft before submitting it for review."
      />
      <WeeklyReportForm
        onDirtyChange={setDirty}
        initialReport={report}
        submitLabel="Save changes"
        saving={saving}
        onSave={save}
        onCancel={() => router.push(`/reports/${id}`)}
      />
      {error && <ErrorState message={error} onRetry={dirty || saving ? undefined : fetchReport} />}
    </div>
  );
}
