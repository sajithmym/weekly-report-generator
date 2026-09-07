import { ValidationPipe } from "@nestjs/common";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import { selectedWeeks, validateReportWeek, weekOf } from "./report-date";

describe("Report input and reporting calendar", () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = (value: unknown, update = false) =>
    pipe.transform(value, {
      type: "body",
      metatype: update ? UpdateReportDto : CreateReportDto,
    });
  it.each(["tasks", "nextWeekTasks", "blockers", "achievements", "workHours"])(
    "rejects null %s on PATCH",
    async (field) => {
      await expect(validate({ [field]: null }, true)).rejects.toMatchObject({
        status: 400,
      });
    },
  );
  it("requires a project on create and rejects malformed or cleared project references", async () => {
    const week = { weekStart: "2026-08-31", weekEnd: "2026-09-06" };
    const projectId = "11111111-1111-4111-8111-111111111111";
    // A project and at least one task are mandatory on create.
    await expect(validate(week)).rejects.toMatchObject({ status: 400 });
    await expect(validate({ ...week, projectId })).rejects.toMatchObject({
      status: 400,
    });
    await expect(validate({ ...week, projectId: "" })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      validate({ ...week, projectId: "invalid" }),
    ).rejects.toMatchObject({ status: 400 });
    // Clearing the project on PATCH is rejected so reports always keep one.
    await expect(validate({ projectId: null }, true)).rejects.toMatchObject({
      status: 400,
    });
    // A valid project reference is accepted on both create and update.
    await expect(
      validate({ ...week, projectId, tasks: [{ taskName: "Task" }] }),
    ).resolves.toMatchObject({ projectId });
    await expect(validate({ projectId }, true)).resolves.toMatchObject({
      projectId,
    });
  });
  it("rejects blank tasks, empty task lists, fractional minutes, and timestamps instead of date-only input", async () => {
    const week = {
      projectId: "11111111-1111-4111-8111-111111111111",
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
    };
    await expect(validate({ ...week, tasks: [] })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      validate({ ...week, tasks: [{ taskName: "   " }] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate({ ...week, tasks: [{ taskName: "Task", actualMinutes: 1.5 }] }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      validate({ ...week, weekStart: "2026-08-31T01:00:00Z" }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("handles Sunday, year boundaries, and invalid reporting ranges", () => {
    expect(weekOf("2026-09-06").toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(weekOf("2027-01-01").toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(() =>
      validateReportWeek(new Date("2026-08-31"), new Date("2026-09-06")),
    ).not.toThrow();
    expect(() =>
      validateReportWeek(new Date("2026-09-01"), new Date("2026-09-07")),
    ).toThrow();
    expect(() => selectedWeeks("2026-09-07", "2026-08-31")).toThrow();
    expect(() => selectedWeeks("2025-01-01", "2026-09-01")).toThrow();
  });
});
