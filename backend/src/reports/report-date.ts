import { BadRequestException } from "@nestjs/common";
import { REPORT_SETTINGS } from "../settings";

export const DAY_MS = REPORT_SETTINGS.calendar.millisecondsPerDay;

/** Reporting dates are calendar dates in UTC; every report covers Monday-Sunday. */
export function weekOf(value: Date | string = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(REPORT_SETTINGS.messages.invalidReportingDate);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
}

export function validateReportWeek(start: Date, end: Date) {
  if (
    start.getTime() !== weekOf(start).getTime() ||
    end.getTime() !==
      start.getTime() + REPORT_SETTINGS.calendar.finalDayOffset * DAY_MS
  ) {
    throw new BadRequestException(
      REPORT_SETTINGS.messages.invalidReportingWeek,
    );
  }

  if (start > weekOf()) {
    throw new BadRequestException(
      REPORT_SETTINGS.messages.futureReportingWeek,
    );
  }
}

export function selectedWeeks(start?: string, end?: string) {
  const first = weekOf(start || end || new Date());
  const last = weekOf(end || start || new Date());
  if (
    last < first ||
    (last.getTime() - first.getTime()) /
      (REPORT_SETTINGS.calendar.daysPerWeek * DAY_MS) >=
      REPORT_SETTINGS.calendar.maxSelectableWeeks
  ) {
    throw new BadRequestException(REPORT_SETTINGS.messages.reportingRangeTooLarge);
  }
  const weeks: Date[] = [];
  for (
    let time = first.getTime();
    time <= last.getTime();
    time += REPORT_SETTINGS.calendar.daysPerWeek * DAY_MS
  )
    weeks.push(new Date(time));
  return {
    first,
    last,
    endExclusive: new Date(
      last.getTime() + REPORT_SETTINGS.calendar.daysPerWeek * DAY_MS,
    ),
    weeks,
  };
}
