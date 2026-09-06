"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type PageRefreshContextValue = {
  revision: number;
  busy: boolean;
  refresh: () => void;
  trackRequest: () => () => void;
};

const PageRefreshContext = createContext<PageRefreshContextValue | null>(null);

/** Scope refresh to the current page, including data loaded by nested components. */
export function PageRefreshProvider({ children }: { children: React.ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const trackRequest = useCallback(() => {
    let finished = false;
    setPendingRequests((count) => count + 1);
    return () => {
      if (finished) return;
      finished = true;
      setPendingRequests((count) => count - 1);
    };
  }, []);
  const value = useMemo(
    () => ({ revision, busy: pendingRequests > 0, refresh, trackRequest }),
    [revision, pendingRequests, refresh, trackRequest],
  );

  return (
    <PageRefreshContext.Provider value={value}>
      {children}
    </PageRefreshContext.Provider>
  );
}

export function usePageRefresh() {
  return useContext(PageRefreshContext);
}
