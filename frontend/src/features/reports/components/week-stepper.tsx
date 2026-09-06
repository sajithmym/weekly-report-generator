"use client";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { reportWeek } from "@/lib/report-week";

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Shows exactly which Monday-Sunday reporting week the surrounding data
 * belongs to, with step controls. Prevents the common mistake of reading a
 * dashboard for one week while a member submitted for another.
 */
export function WeekStepper({
  weekStart,
  weekEnd,
  onChange,
}: {
  weekStart: string;
  weekEnd: string;
  onChange: (weekStart: string) => void;
}) {
  // Frontend calendar settings carry day-length only; a reporting week is 7 days.
  const shiftWeek = (days: number) =>
    onChange(reportWeek(addDays(weekStart, days)).weekStart);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Viewing reporting week
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous reporting week"
            onClick={() => shiftWeek(-7)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-56 text-center text-sm font-semibold">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next reporting week"
            onClick={() => shiftWeek(7)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        All cards, charts, and the submission table below reflect this exact
        Monday–Sunday week. Reports submitted for other weeks appear only when
        that week is selected.
      </p>
    </div>
  );
}
