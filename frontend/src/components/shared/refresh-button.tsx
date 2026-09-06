"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RefreshButtonProps = {
  onRefresh: () => void;
  refreshing: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function RefreshButton({
  onRefresh,
  refreshing,
  disabled = false,
  disabledReason,
}: RefreshButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onRefresh}
      disabled={disabled || refreshing}
      aria-busy={refreshing}
      title={disabled ? disabledReason : "Refresh page data"}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn("mr-2 h-4 w-4", refreshing && "motion-safe:animate-spin")}
      />
      <span aria-live="polite">{refreshing ? "Refreshing..." : "Refresh"}</span>
    </Button>
  );
}
