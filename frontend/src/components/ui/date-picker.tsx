"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { CalendarProps } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: string | Date | null;
  onChange?: (date: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledDates?: CalendarProps["disabled"];
  className?: string;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  disabledDates,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = value
    ? typeof value === "string"
      ? new Date(`${value.slice(0, 10)}T12:00:00`)
      : value
    : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      onChange?.(`${year}-${month}-${day}`);
    } else {
      onChange?.(undefined);
    }
    setOpen(false);
  };

  const selectedLabel = selectedDate
    ? format(selectedDate, "EEE, dd MMM yyyy")
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn(
            "h-11 w-full justify-start rounded-lg border-input bg-background px-3 text-left font-medium shadow-sm transition-all hover:border-primary/40 hover:bg-primary/[0.02] focus-visible:ring-primary/40",
            !selectedDate && "text-muted-foreground",
            className,
          )}
          disabled={disabled}
          aria-label={
            selectedDate ? `Selected date: ${selectedLabel}` : placeholder
          }
        >
          <span className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="truncate">{selectedLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[20rem] rounded-xl border-border/80 bg-popover p-2 shadow-xl shadow-slate-950/10"
        align="start"
        sideOffset={8}
        collisionPadding={16}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={disabledDates}
          footer={
            <div className="mx-1 mt-2 border-t border-border/70 px-1 pt-3 text-xs font-medium text-muted-foreground">
              {selectedDate
                ? `Selected: ${format(selectedDate, "dd MMMM yyyy")}`
                : "Select a date"}
            </div>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
