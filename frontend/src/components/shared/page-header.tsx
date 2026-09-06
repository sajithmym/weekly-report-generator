"use client";

import { cn } from "@/lib/utils";
import { usePageRefresh } from "@/lib/page-refresh";
import { RefreshButton } from "./refresh-button";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  refreshDisabled?: boolean;
  refreshDisabledReason?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className,
  refreshDisabled,
  refreshDisabledReason,
}: PageHeaderProps) {
  const pageRefresh = usePageRefresh();
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 sm:min-w-[12rem]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {(action || pageRefresh) && (
        <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
          {pageRefresh && (
            <RefreshButton
              onRefresh={pageRefresh.refresh}
              refreshing={pageRefresh.busy}
              disabled={refreshDisabled}
              disabledReason={refreshDisabledReason}
            />
          )}
          {action}
        </div>
      )}
      {refreshDisabled && refreshDisabledReason && (
        <p className="text-xs text-muted-foreground sm:basis-full">
          {refreshDisabledReason}
        </p>
      )}
    </div>
  );
}
