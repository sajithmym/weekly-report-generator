"use client";

import { useEffect } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import {
  reportFormSchema,
  type ReportFormData,
} from "@/features/reports/schemas/report.schema";
import { reportWeek } from "@/lib/report-week";
import { EntityPicker } from "@/components/shared/entity-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  WORK_HOUR_TYPES,
  WORK_HOUR_TYPE_LABELS,
} from "@/constants";
import type { Project, Report } from "@/types";
import { REPORT_SETTINGS, VALIDATION_SETTINGS } from "@/lib/settings";

type WeeklyReportFormProps = {
  initialReport?: Report;
  submitLabel: string;
  saving: boolean;
  onSave: (data: ReportFormData) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const defaultValues: ReportFormData = {
  projectId: "",
  ...reportWeek(),
  notes: "",
  tasks: [],
  nextWeekTasks: [],
  blockers: [],
  achievements: [],
  workHours: [],
};

export function WeeklyReportForm({
  initialReport,
  submitLabel,
  saving,
  onSave,
  onCancel,
  onDirtyChange,
}: WeeklyReportFormProps) {
  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: initialReport
      ? reportToFormData(initialReport)
      : defaultValues,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form;
  // Custom controls must participate in dirty tracking just like registered inputs.
  const setValue: typeof form.setValue = (name, value, options) =>
    form.setValue(name, value, { ...options, shouldDirty: true });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (initialReport && !isDirty) reset(reportToFormData(initialReport));
  }, [initialReport, isDirty, reset]);
  const values = useWatch({ control });
  const taskFields = useFieldArray({ control, name: "tasks" });
  const nextWeekFields = useFieldArray({ control, name: "nextWeekTasks" });
  const blockerFields = useFieldArray({ control, name: "blockers" });
  const achievementFields = useFieldArray({ control, name: "achievements" });
  const workHourFields = useFieldArray({ control, name: "workHours" });

  return (
    <form
      onSubmit={handleSubmit((data) =>
        onSave({ ...data, projectId: data.projectId || null }),
      )}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Week information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field
            label="Project"
            controlId="report-project"
            error={errors.projectId?.message}
          >
            <EntityPicker
              id="report-project"
              kind="project"
              value={values.projectId || ""}
              selectedLabel={initialReport?.project?.name}
              emptyLabel="No project selected"
              onChange={(value) =>
                setValue("projectId", value || null, { shouldValidate: true })
              }
            />
          </Field>
          <Field
            label="Week start"
            controlId="report-week-start"
            error={errors.weekStart?.message}
          >
            <DatePicker
              id="report-week-start"
              value={values.weekStart}
              onChange={(date) => {
                if (date) {
                  const week = reportWeek(date);
                  setValue("weekStart", week.weekStart, {
                    shouldValidate: true,
                  });
                  setValue("weekEnd", week.weekEnd, { shouldValidate: true });
                }
              }}
              placeholder="Select start date"
            />
          </Field>
          <Field
            label="Week end"
            controlId="report-week-end"
            error={errors.weekEnd?.message}
          >
            <Input id="report-week-end" value={values.weekEnd || ""} readOnly />
          </Field>
        </CardContent>
      </Card>

      <Section
        title="Completed tasks"
        description="Capture what was planned, delivered, and the time spent."
        onAdd={() =>
          taskFields.append({
            taskName: "",
            priority: REPORT_SETTINGS.defaultTaskPriority,
            plannedPercentage: REPORT_SETTINGS.defaultNumericValue,
            actualPercentage: REPORT_SETTINGS.defaultNumericValue,
            status: REPORT_SETTINGS.defaultTaskStatus,
            plannedMinutes: REPORT_SETTINGS.defaultNumericValue,
            actualMinutes: REPORT_SETTINGS.defaultNumericValue,
            deliverable: "",
          })
        }
      >
        {taskFields.fields.length === 0 ? (
          <EmptyRow text="No completed tasks added yet." />
        ) : (
          taskFields.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-12"
            >
              <Field
                className="md:col-span-4"
                label="Task"
                controlId={`task-${field.id}-name`}
                error={errors.tasks?.[index]?.taskName?.message}
              >
                <Input
                  id={`task-${field.id}-name`}
                  {...register(`tasks.${index}.taskName`)}
                  placeholder="Task name"
                />
              </Field>
              <Field
                className="md:col-span-2"
                label="Priority"
                controlId={`task-${field.id}-priority`}
              >
                <Select
                  value={
                    values.tasks?.[index]?.priority ??
                    REPORT_SETTINGS.defaultTaskPriority
                  }
                  onValueChange={(value) =>
                    setValue(
                      `tasks.${index}.priority`,
                      value as ReportFormData["tasks"][number]["priority"],
                    )
                  }
                >
                  <SelectTrigger id={`task-${field.id}-priority`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {TASK_PRIORITY_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                className="md:col-span-2"
                label="Status"
                controlId={`task-${field.id}-status`}
              >
                <Select
                  value={
                    values.tasks?.[index]?.status ??
                    REPORT_SETTINGS.defaultTaskStatus
                  }
                  onValueChange={(value) =>
                    setValue(
                      `tasks.${index}.status`,
                      value as ReportFormData["tasks"][number]["status"],
                    )
                  }
                >
                  <SelectTrigger id={`task-${field.id}-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {TASK_STATUS_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <RemoveButton
                className="md:col-span-4 md:justify-self-end"
                onClick={() => taskFields.remove(index)}
              />
              <NumberField
                className="md:col-span-2"
                label="Planned %"
                controlId={`task-${field.id}-planned-percentage`}
                error={errors.tasks?.[index]?.plannedPercentage?.message}
                input={register(`tasks.${index}.plannedPercentage`, {
                  valueAsNumber: true,
                })}
                min={VALIDATION_SETTINGS.percentage.min}
                max={VALIDATION_SETTINGS.percentage.max}
              />
              <NumberField
                className="md:col-span-2"
                label="Actual %"
                controlId={`task-${field.id}-actual-percentage`}
                error={errors.tasks?.[index]?.actualPercentage?.message}
                input={register(`tasks.${index}.actualPercentage`, {
                  valueAsNumber: true,
                })}
                min={VALIDATION_SETTINGS.percentage.min}
                max={VALIDATION_SETTINGS.percentage.max}
              />
              <NumberField
                className="md:col-span-2"
                label="Planned minutes"
                controlId={`task-${field.id}-planned-minutes`}
                error={errors.tasks?.[index]?.plannedMinutes?.message}
                input={register(`tasks.${index}.plannedMinutes`, {
                  valueAsNumber: true,
                })}
              />
              <NumberField
                className="md:col-span-2"
                label="Actual minutes"
                controlId={`task-${field.id}-actual-minutes`}
                error={errors.tasks?.[index]?.actualMinutes?.message}
                input={register(`tasks.${index}.actualMinutes`, {
                  valueAsNumber: true,
                })}
              />
              <Field
                className="md:col-span-4"
                label="Deliverable"
                controlId={`task-${field.id}-deliverable`}
                error={errors.tasks?.[index]?.deliverable?.message}
              >
                <Input
                  id={`task-${field.id}-deliverable`}
                  {...register(`tasks.${index}.deliverable`)}
                  placeholder="Link, artefact, or outcome"
                />
              </Field>
            </div>
          ))
        )}
      </Section>

      <Section
        title="Next-week tasks"
        onAdd={() =>
          nextWeekFields.append({
            description: "",
            sortOrder: nextWeekFields.fields.length,
          })
        }
      >
        {nextWeekFields.fields.length === 0 ? (
          <EmptyRow text="No next-week tasks added yet." />
        ) : (
          nextWeekFields.fields.map((field, index) => (
            <div key={field.id} className="flex gap-3">
              <Field
                className="flex-1"
                label={`Task ${index + 1}`}
                controlId={`next-week-task-${field.id}`}
                error={errors.nextWeekTasks?.[index]?.description?.message}
              >
                <Input
                  id={`next-week-task-${field.id}`}
                  {...register(`nextWeekTasks.${index}.description`)}
                  placeholder="Planned task"
                />
              </Field>
              <RemoveButton
                className="self-end"
                onClick={() => nextWeekFields.remove(index)}
              />
            </div>
          ))
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Blockers"
          description="Select at most one key issue."
          onAdd={() =>
            blockerFields.append({
              description: "",
              isKeyIssue: false,
              isResolved: false,
            })
          }
        >
          {blockerFields.fields.length === 0 ? (
            <EmptyRow text="No blockers added." />
          ) : (
            blockerFields.fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex gap-2">
                  <Field
                    className="flex-1"
                    label="Blocker"
                    controlId={`blocker-${field.id}`}
                    error={errors.blockers?.[index]?.description?.message}
                  >
                    <Input
                      id={`blocker-${field.id}`}
                      {...register(`blockers.${index}.description`)}
                      placeholder="Describe the blocker"
                    />
                  </Field>
                  <RemoveButton
                    className="self-end"
                    onClick={() => blockerFields.remove(index)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register(`blockers.${index}.isKeyIssue`)}
                      onChange={(event) => {
                        blockerFields.fields.forEach((_, itemIndex) =>
                          setValue(
                            `blockers.${itemIndex}.isKeyIssue`,
                            itemIndex === index && event.target.checked,
                          ),
                        );
                      }}
                    />
                    Key issue
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register(`blockers.${index}.isResolved`)}
                    />
                    Resolved
                  </label>
                </div>
              </div>
            ))
          )}
        </Section>
        <Section
          title="Achievements"
          description="Select at most one key achievement."
          onAdd={() =>
            achievementFields.append({
              description: "",
              isKeyAchievement: false,
            })
          }
        >
          {achievementFields.fields.length === 0 ? (
            <EmptyRow text="No achievements added." />
          ) : (
            achievementFields.fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex gap-2">
                  <Field
                    className="flex-1"
                    label="Achievement"
                    controlId={`achievement-${field.id}`}
                    error={errors.achievements?.[index]?.description?.message}
                  >
                    <Input
                      id={`achievement-${field.id}`}
                      {...register(`achievements.${index}.description`)}
                      placeholder="Describe the achievement"
                    />
                  </Field>
                  <RemoveButton
                    className="self-end"
                    onClick={() => achievementFields.remove(index)}
                  />
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...register(`achievements.${index}.isKeyAchievement`)}
                    onChange={(event) => {
                      achievementFields.fields.forEach((_, itemIndex) =>
                        setValue(
                          `achievements.${itemIndex}.isKeyAchievement`,
                          itemIndex === index && event.target.checked,
                        ),
                      );
                    }}
                  />
                  Key achievement
                </label>
              </div>
            ))
          )}
        </Section>
      </div>

      <Section
        title="Work hours"
        description="Use whole minutes for each category."
        onAdd={() =>
          workHourFields.append({
            type: REPORT_SETTINGS.defaultWorkHourType,
            minutes: REPORT_SETTINGS.defaultNumericValue,
          })
        }
      >
        {workHourFields.fields.length === 0 ? (
          <EmptyRow text="No work hours added." />
        ) : (
          workHourFields.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-[1fr_180px_auto]"
            >
              <Field
                label="Category"
                controlId={`work-hour-${field.id}-category`}
              >
                <Select
                  value={
                    values.workHours?.[index]?.type ??
                    REPORT_SETTINGS.defaultWorkHourType
                  }
                  onValueChange={(value) =>
                    setValue(
                      `workHours.${index}.type`,
                      value as ReportFormData["workHours"][number]["type"],
                    )
                  }
                >
                  <SelectTrigger id={`work-hour-${field.id}-category`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_HOUR_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {WORK_HOUR_TYPE_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <NumberField
                label="Minutes"
                controlId={`work-hour-${field.id}-minutes`}
                error={errors.workHours?.[index]?.minutes?.message}
                input={register(`workHours.${index}.minutes`, {
                  valueAsNumber: true,
                })}
              />
              <RemoveButton
                className="self-end"
                onClick={() => workHourFields.remove(index)}
              />
            </div>
          ))
        )}
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>Notes and links</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="report-notes">Notes and links</Label>
          <Textarea
            id="report-notes"
            {...register("notes")}
            placeholder="Add context, decisions, risks, or relevant links."
            className="mt-2 min-h-32"
          />
          {errors.notes && (
            <p className="mt-2 text-sm text-destructive">
              {errors.notes.message}
            </p>
          )}
        </CardContent>
      </Card>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Check the highlighted fields. Each section allows at most{" "}
          {REPORT_SETTINGS.maxItemsPerSection} items; percentages and minutes
          must be whole numbers.
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function reportToFormData(report: Report): ReportFormData {
  return {
    projectId: report.projectId || "",
    weekStart: report.weekStart.slice(0, 10),
    weekEnd: report.weekEnd.slice(0, 10),
    notes: report.notes || "",
    tasks: (report.tasks || []).map(
      ({
        taskName,
        priority,
        plannedPercentage,
        actualPercentage,
        status,
        plannedMinutes,
        actualMinutes,
        deliverable,
      }) => ({
        taskName,
        priority,
        plannedPercentage,
        actualPercentage,
        status,
        plannedMinutes,
        actualMinutes,
        deliverable: deliverable || "",
      }),
    ),
    nextWeekTasks: (report.nextWeekTasks || []).map(
      ({ description, sortOrder }) => ({ description, sortOrder }),
    ),
    blockers: (report.blockers || []).map(
      ({ description, isKeyIssue, isResolved }) => ({
        description,
        isKeyIssue,
        isResolved,
      }),
    ),
    achievements: (report.achievements || []).map(
      ({ description, isKeyAchievement }) => ({
        description,
        isKeyAchievement,
      }),
    ),
    workHours: (report.workHours || []).map(({ type, minutes }) => ({
      type,
      minutes,
    })),
  };
}

function Field({
  label,
  error,
  className,
  children,
  controlId,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  controlId?: string;
}) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label htmlFor={controlId}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
function NumberField({
  label,
  error,
  input,
  min,
  max,
  className,
  controlId,
}: {
  label: string;
  error?: string;
  input: UseFormRegisterReturn;
  min?: number;
  max?: number;
  className?: string;
  controlId?: string;
}) {
  return (
    <Field
      label={label}
      error={error}
      className={className}
      controlId={controlId}
    >
      <Input
        id={controlId}
        type="number"
        min={min ?? VALIDATION_SETTINGS.minutes.min}
        max={max ?? VALIDATION_SETTINGS.minutes.max}
        {...input}
      />
    </Field>
  );
}
function Section({
  title,
  description,
  onAdd,
  children,
}: {
  title: string;
  description?: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
function RemoveButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={onClick}
      aria-label="Remove item"
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
