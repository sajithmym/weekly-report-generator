"use client";
import { useCallback, useId, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { projectsApi } from "@/services/projects.api";
import { usersApi } from "@/services/users.api";
import { useResource } from "@/lib/use-resource";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "./pagination";
import { PAGINATION_SETTINGS, USER_ROLES } from "@/lib/settings";

export function EntityPicker({
  kind,
  value,
  onChange,
  selectedLabel,
  includeArchived = false,
  emptyLabel,
  id: controlId,
}: {
  kind: "project" | "member";
  value: string;
  onChange: (value: string) => void;
  selectedLabel?: string;
  includeArchived?: boolean;
  emptyLabel: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<number>(PAGINATION_SETTINGS.defaultPage);
  const [selected, setSelected] = useState<{ id: string; name: string }>();
  const id = useId();
  const loader = useCallback(async () => {
    const response =
      kind === "project"
        ? await projectsApi.getAll({
            page,
            limit: PAGINATION_SETTINGS.defaultLimit,
            search: search || undefined,
            isActive: includeArchived ? undefined : true,
          })
        : await usersApi.getAll({
            page,
            limit: PAGINATION_SETTINGS.defaultLimit,
            search: search || undefined,
            role: USER_ROLES.TEAM_MEMBER,
          });
    return {
      data: response.data.map((item) => ({
        id: item.id,
        name:
          item.name +
          ("description" in item && !item.isActive ? " (archived)" : ""),
      })),
      meta: response.meta,
    };
  }, [kind, page, search, includeArchived]);
  const { data, loading, error, reload } = useResource(loader);
  const choose = (option?: { id: string; name: string }) => {
    setSelected(option);
    onChange(option?.id || "");
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={controlId}
          type="button"
          variant="outline"
          className="h-11 w-full justify-between rounded-lg border-input bg-background px-3 text-left font-medium shadow-sm transition-all hover:border-primary/40 hover:bg-primary/[0.02] focus-visible:ring-primary/40"
          aria-label={`Select ${kind}`}
        >
          <span className="min-w-0 truncate">
            {value
              ? selected?.id === value
                ? selected.name
                : selectedLabel || `Selected ${kind}`
              : emptyLabel}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border-border/80 p-1.5 shadow-xl shadow-slate-950/10"
        align="start"
        sideOffset={8}
        collisionPadding={16}
      >
        <div className="space-y-2 border-b border-border/70 p-2 pb-3">
          <label htmlFor={id} className="text-sm font-semibold">
            Search {kind === "project" ? "projects" : "members"}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={id}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(PAGINATION_SETTINGS.defaultPage);
              }}
              className="h-10 rounded-lg pl-9 focus-visible:ring-primary/40"
              placeholder="Search by name"
            />
          </div>
        </div>
        <div className="max-h-64 space-y-1 overflow-auto p-1">
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-between rounded-lg px-3 text-left hover:bg-primary/10 hover:text-primary"
            onClick={() => choose()}
          >
            <span>{emptyLabel}</span>
            {!value && <Check className="h-4 w-4 text-primary" />}
          </Button>
          {loading ? (
            <p className="p-2 text-sm">Loading…</p>
          ) : error ? (
            <div>
              <p role="alert">{error}</p>
              <Button type="button" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : data?.data.length ? (
            data.data.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                className={`h-10 w-full justify-between rounded-lg px-3 text-left hover:bg-primary/10 hover:text-primary ${
                  value === option.id
                    ? "bg-primary/10 font-medium text-primary"
                    : ""
                }`}
                onClick={() => choose(option)}
              >
                <span className="truncate">{option.name}</span>
                {value === option.id && (
                  <Check className="ml-2 h-4 w-4 shrink-0" />
                )}
              </Button>
            ))
          ) : (
            <p className="p-2 text-sm">No matches.</p>
          )}
        </div>
        {data && (
          <div className="border-t border-border/70 p-2 pt-3">
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
      </PopoverContent>
      {error && !open && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Could not load {kind === "project" ? "projects" : "members"}: {error}
        </p>
      )}
    </Popover>
  );
}
