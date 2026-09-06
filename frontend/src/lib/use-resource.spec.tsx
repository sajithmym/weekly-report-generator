import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useResource } from "./use-resource";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useResource", () => {
  it("discards obsolete state after a mutation even when the next read fails", async () => {
    const loader = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("DRAFT")
      .mockRejectedValueOnce(new Error("Could not fetch submitted report"))
      .mockResolvedValueOnce("SUBMITTED");
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.data).toBe("DRAFT"));
    act(() => result.current.invalidate());
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.error).toBe("Could not fetch submitted report"));
    expect(result.current.data).toBeUndefined();
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("SUBMITTED"));
  });
  it("returns loaded data and exposes a reload function", async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first response")
      .mockResolvedValueOnce("second response");
    const { result } = renderHook(() => useResource(loader));

    await waitFor(() => expect(result.current.data).toBe("first response"));
    expect(result.current.loading).toBe(false);

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe("second response"));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("uses the server message when a loader fails", async () => {
    const loader = vi.fn().mockRejectedValue({
      response: { data: { message: "You do not have access" } },
    });
    const { result } = renderHook(() => useResource(loader));

    await waitFor(() => expect(result.current.error).toBe("You do not have access"));
    expect(result.current).toMatchObject({ loading: false, data: undefined });
  });

  it("falls back to an Error message and then a user-safe generic message", async () => {
    const errorLoader = vi.fn().mockRejectedValue(new Error("Request timed out"));
    const { result, rerender } = renderHook(
      ({ loader }) => useResource(loader),
      { initialProps: { loader: errorLoader } },
    );
    await waitFor(() => expect(result.current.error).toBe("Request timed out"));

    const unknownErrorLoader = vi.fn().mockRejectedValue({});
    rerender({ loader: unknownErrorLoader });
    await waitFor(() => expect(result.current.error).toBe("Could not load data."));
  });

  it("ignores stale responses when its loader changes", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const firstLoader = vi.fn(() => first.promise);
    const secondLoader = vi.fn(() => second.promise);
    const { result, rerender } = renderHook(
      ({ loader }) => useResource(loader),
      { initialProps: { loader: firstLoader } },
    );

    rerender({ loader: secondLoader });
    first.resolve("stale data");
    second.resolve("current data");

    await waitFor(() => expect(result.current.data).toBe("current data"));
    expect(result.current.error).toBeUndefined();
  });

  it("does not show the previous resource while a different loader is pending", async () => {
    const firstLoader = vi.fn().mockResolvedValue("First report");
    const second = deferred<string>();
    const secondLoader = vi.fn(() => second.promise);
    const { result, rerender } = renderHook(
      ({ loader }) => useResource(loader),
      { initialProps: { loader: firstLoader } },
    );
    await waitFor(() => expect(result.current.data).toBe("First report"));
    rerender({ loader: secondLoader });
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await act(async () => second.resolve("Second report"));
    expect(result.current.data).toBe("Second report");
  });

  it("handles synchronous loader failures", async () => {
    const loader = vi.fn(() => { throw new Error("Invalid request"); });
    const { result } = renderHook(() => useResource(loader));
    await waitFor(() => expect(result.current.error).toBe("Invalid request"));
    expect(result.current.loading).toBe(false);
  });
});
