import { describe, expect, it } from "vitest";
import { reportFormSchema } from "./report.schema";

const projectId = "11111111-1111-4111-8111-111111111111";
const week = {
  projectId,
  weekStart: "2026-08-31",
  weekEnd: "2026-09-06",
  tasks: [{ taskName: "Base task" }],
};

describe("weekly report form schema", () => {
  it.each([
    { weekStart: "2026-09-01", weekEnd: "2026-09-07" },
    { weekStart: "2026-08-31", weekEnd: "2026-09-05" },
    { weekStart: "2026-08-31", weekEnd: "2026-09-13" },
    { weekStart: "2026-02-30", weekEnd: "2026-03-08" },
    { weekStart: "2026-08-31T00:00:00Z", weekEnd: "2026-09-06" },
    { weekStart: "not-a-date", weekEnd: "2026-09-06" },
  ])("rejects calendar input that the API would reject: %j", (range) => {
    expect(reportFormSchema.safeParse(range).success).toBe(false);
  });

  it.each([
    { weekStart: "2026-12-28", weekEnd: "2027-01-03" },
    { weekStart: "2024-02-26", weekEnd: "2024-03-03" },
  ])("accepts valid year and leap-year boundaries: %j", (range) => {
    expect(reportFormSchema.safeParse({ ...week, ...range }).success).toBe(
      true,
    );
  });

  it("allows incomplete drafts but rejects malformed project references", () => {
    expect(
      reportFormSchema.safeParse({ ...week, projectId: "", tasks: [] }).success,
    ).toBe(true);
    expect(
      reportFormSchema.safeParse({ ...week, projectId: null }).success,
    ).toBe(false);
    expect(
      reportFormSchema.safeParse({ ...week, projectId: "invalid" }).success,
    ).toBe(false);
    expect(reportFormSchema.safeParse({ ...week, tasks: [] }).success).toBe(true);
    expect(
      reportFormSchema.safeParse({
        ...week,
        tasks: [{ taskName: " " }],
      }).success,
    ).toBe(false);

    expect(
      reportFormSchema.parse({ ...week, projectId: "", tasks: [] }).projectId,
    ).toBeUndefined();
  });

  it("still validates key selections while requiring the project and task", () => {
    expect(
      reportFormSchema.safeParse({
        ...week,
        blockers: [
          { description: "A", isKeyIssue: true },
          { description: "B", isKeyIssue: true },
        ],
      }).success,
    ).toBe(false);
    expect(
      reportFormSchema.safeParse({
        ...week,
        achievements: [
          { description: "A", isKeyAchievement: true },
          { description: "B", isKeyAchievement: true },
        ],
      }).success,
    ).toBe(false);
  });

  it("trims content and applies report defaults", () => {
    const result = reportFormSchema.parse({
      ...week,
      tasks: [{ taskName: "  Deliver feature  " }],
      nextWeekTasks: [{ description: "  Test release  " }],
      blockers: [{ description: "  Waiting on feedback  " }],
      achievements: [{ description: "  Shipped dashboard  " }],
      workHours: [{ type: "DEVELOPMENT", minutes: 90 }],
    });

    expect(result).toMatchObject({
      tasks: [
        {
          taskName: "Deliver feature",
          priority: "MEDIUM",
          status: "TODO",
          plannedPercentage: 0,
          actualMinutes: 0,
        },
      ],
      nextWeekTasks: [{ description: "Test release", sortOrder: 0 }],
      blockers: [
        {
          description: "Waiting on feedback",
          isKeyIssue: false,
          isResolved: false,
        },
      ],
      achievements: [
        { description: "Shipped dashboard", isKeyAchievement: false },
      ],
      workHours: [{ type: "DEVELOPMENT", minutes: 90 }],
    });
  });

  it.each([
    [{ ...week, tasks: [{ taskName: " " }] }, "Task name is required"],
    [
      { ...week, tasks: [{ taskName: "Task", actualPercentage: 101 }] },
      "Number must be less than or equal to 100",
    ],
    [
      { ...week, tasks: [{ taskName: "Task", plannedMinutes: 1.5 }] },
      "Expected integer, received float",
    ],
    [
      { ...week, workHours: [{ type: "DEVELOPMENT", minutes: -1 }] },
      "Number must be greater than or equal to 0",
    ],
    [
      { ...week, nextWeekTasks: [{ description: " " }] },
      "Description is required",
    ],
  ])("rejects invalid report fields", (input, message) => {
    const result = reportFormSchema.safeParse(input);
    expect(result).toMatchObject({ success: false });
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ message })]),
      );
  });

  it("rejects a reporting range that ends before it begins", () => {
    const result = reportFormSchema.safeParse({
      ...week,
      weekStart: "2026-09-07",
      weekEnd: "2026-09-06",
    });

    expect(result).toMatchObject({ success: false });
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["weekEnd"],
            message: "Week end must be after or equal to week start",
          }),
        ]),
      );
  });

  it("limits each repeatable section to fifty entries", () => {
    const result = reportFormSchema.safeParse({
      ...week,
      tasks: Array.from({ length: 51 }, (_, index) => ({
        taskName: `Task ${index}`,
      })),
    });

    expect(result).toMatchObject({ success: false });
    if (!result.success)
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["tasks"],
            message: "Array must contain at most 50 element(s)",
          }),
        ]),
      );
  });
});
