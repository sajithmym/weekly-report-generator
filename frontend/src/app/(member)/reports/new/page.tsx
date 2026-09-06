"use client";

import { useRouter } from "next/navigation";
import { reportsApi } from "@/services/reports.api";
import { WeeklyReportForm } from "@/features/reports/components/weekly-report-form";
import type { ReportFormData } from "@/features/reports/schemas/report.schema";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/ui/toast";
import { useState } from "react";
import { getErrorMessage } from "@/lib/utils";

export default function NewReportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const createReport = async (data: ReportFormData) => {
    setSaving(true);
    try {
      const report = await reportsApi.create(data);
      toast({ variant: "success", title: "Draft created", description: "You can keep editing it until you submit." });
      router.push(`/reports/${report.id}`);
    } catch (error) {
      toast({ variant: "error", title: "Could not create draft", description: getErrorMessage(error, "Please review the form and try again.") });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create weekly report"
        description="Save a complete draft, then submit it for manager review."
        refreshDisabled={saving}
      />
      <WeeklyReportForm
        submitLabel="Save draft"
        saving={saving}
        onSave={createReport}
        onCancel={() => router.back()}
      />
    </div>
  );
}
