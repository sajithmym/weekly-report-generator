"use client";
import { useCallback, useEffect, useState } from "react";
import { usePageRefresh } from "./page-refresh";
import { getErrorMessage } from "./utils";

/** Ignore stale responses when filters change or the view unmounts. */
export function useResource<T>(loader: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const pageRefresh = usePageRefresh();
  const pageRevision = pageRefresh?.revision ?? 0;
  const trackRequest = pageRefresh?.trackRequest;
  const [state, setState] = useState<{
    loader: typeof loader;
    revision: number;
    pageRevision: number;
    data?: T;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const finishRequest = trackRequest?.();
    Promise.resolve()
      .then(loader)
      .then(
        (data) => {
          if (active) setState({ loader, revision, pageRevision, data });
        },
        (error) => {
          if (active)
            setState((previous) => ({
              loader,
              revision,
              pageRevision,
              data: previous?.loader === loader ? previous.data : undefined,
              error: getErrorMessage(error, "Could not load data."),
            }));
        },
      )
      .finally(finishRequest);
    return () => {
      active = false;
      finishRequest?.();
    };
  }, [loader, revision, pageRevision, trackRequest]);
  const sameLoader = state?.loader === loader;
  const current =
    sameLoader &&
    state?.revision === revision &&
    state?.pageRevision === pageRevision;
  // Keep the current view mounted during refresh; never carry data across filters or IDs.
  const data = sameLoader ? state.data : undefined;
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  // After a write, old status/actions are no longer safe to display if the next read fails.
  const invalidate = useCallback(() => {
    setState(undefined);
    setRevision((value) => value + 1);
  }, []);
  return {
    data,
    error: current ? state.error : undefined,
    loading: !current && data === undefined,
    refreshing: !current && data !== undefined,
    reload,
    invalidate,
  };
}
