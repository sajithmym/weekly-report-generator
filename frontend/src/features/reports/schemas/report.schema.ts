import { z } from "zod";
import { REPORT_SETTINGS, VALIDATION_SETTINGS } from "@/lib/settings";
import { reportWeek } from "@/lib/report-week";

const reportingDateSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!VALIDATION_SETTINGS.datePattern.test(value)) return false;
    const date = new Date(value);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date using YYYY-MM-DD");

const optionalProjectIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().uuid("Select a valid project").optional(),
);

const taskSchema = z.object({
  taskName: z
    .string()
    .trim()
    .min(VALIDATION_SETTINGS.taskName.min, "Task name is required")
    .max(VALIDATION_SETTINGS.taskName.max),
  priority: z
    .enum(REPORT_SETTINGS.taskPriorities)
    .default(REPORT_SETTINGS.defaultTaskPriority),
  plannedPercentage: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.percentage.min)
    .max(VALIDATION_SETTINGS.percentage.max)
    .default(REPORT_SETTINGS.defaultNumericValue),
  actualPercentage: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.percentage.min)
    .max(VALIDATION_SETTINGS.percentage.max)
    .default(REPORT_SETTINGS.defaultNumericValue),
  status: z
    .enum(REPORT_SETTINGS.taskStatuses)
    .default(REPORT_SETTINGS.defaultTaskStatus),
  plannedMinutes: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.minutes.min)
    .max(VALIDATION_SETTINGS.minutes.max)
    .default(REPORT_SETTINGS.defaultNumericValue),
  actualMinutes: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.minutes.min)
    .max(VALIDATION_SETTINGS.minutes.max)
    .default(REPORT_SETTINGS.defaultNumericValue),
  deliverable: z.string().max(VALIDATION_SETTINGS.deliverable.max).optional(),
});

const nextWeekTaskSchema = z.object({
  description: z
    .string()
    .trim()
    .min(VALIDATION_SETTINGS.description.min, "Description is required")
    .max(VALIDATION_SETTINGS.description.max),
  sortOrder: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.sortOrder.min)
    .default(REPORT_SETTINGS.defaultNumericValue),
});

const blockerSchema = z.object({
  description: z
    .string()
    .trim()
    .min(VALIDATION_SETTINGS.description.min, "Description is required")
    .max(VALIDATION_SETTINGS.description.max),
  isKeyIssue: z.boolean().default(false),
  isResolved: z.boolean().default(false),
});

const achievementSchema = z.object({
  description: z
    .string()
    .trim()
    .min(VALIDATION_SETTINGS.description.min, "Description is required")
    .max(VALIDATION_SETTINGS.description.max),
  isKeyAchievement: z.boolean().default(false),
});

const workHourSchema = z.object({
  type: z.enum(REPORT_SETTINGS.workHourTypes),
  minutes: z
    .number()
    .int()
    .min(VALIDATION_SETTINGS.minutes.min)
    .max(VALIDATION_SETTINGS.minutes.max),
});

export const reportFormSchema = z
  .object({
    projectId: optionalProjectIdSchema,
    weekStart: reportingDateSchema,
    weekEnd: reportingDateSchema,
    notes: z.string().max(VALIDATION_SETTINGS.reportNotes.max).optional(),
    tasks: z
      .array(taskSchema)
      .max(REPORT_SETTINGS.maxItemsPerSection),
    nextWeekTasks: z
      .array(nextWeekTaskSchema)
      .max(REPORT_SETTINGS.maxItemsPerSection)
      .default([]),
    blockers: z
      .array(blockerSchema)
      .max(REPORT_SETTINGS.maxItemsPerSection)
      .default([]),
    achievements: z
      .array(achievementSchema)
      .max(REPORT_SETTINGS.maxItemsPerSection)
      .default([]),
    workHours: z
      .array(workHourSchema)
      .max(REPORT_SETTINGS.maxItemsPerSection)
      .default([]),
  })
  .refine(
    (data) => {
      if (data.weekStart && data.weekEnd) {
        return new Date(data.weekEnd) >= new Date(data.weekStart);
      }
      return true;
    },
    {
      message: "Week end must be after or equal to week start",
      path: ["weekEnd"],
    },
  )
  .superRefine((data, context) => {
    if (
      reportingDateSchema.safeParse(data.weekStart).success &&
      reportingDateSchema.safeParse(data.weekEnd).success
    ) {
      const week = reportWeek(data.weekStart);
      if (data.weekStart !== week.weekStart)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weekStart"],
          message: "Reporting weeks must start on Monday",
        });
      if (data.weekEnd !== week.weekEnd)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weekEnd"],
          message: "Reporting weeks must end on the following Sunday",
        });
    }
    if (data.blockers.filter((blocker) => blocker.isKeyIssue).length > 1)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blockers"],
        message: "Select at most one key issue",
      });
    if (
      data.achievements.filter((achievement) => achievement.isKeyAchievement)
        .length > 1
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["achievements"],
        message: "Select at most one key achievement",
      });
  });

export type ReportFormData = z.infer<typeof reportFormSchema>;
