import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/shared/page-header";
import { PageRefreshProvider } from "./page-refresh";
import { useResource } from "./use-resource";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function Resource({ loader }: { loader: () => Promise<string> }) {
  const { data, error } = useResource(loader);
  return <div>{data}{error && <p role="alert">{error}</p>}</div>;
}

describe("page refresh", () => {
  it("refreshes nested resources, keeps content visible, and waits for every request", async () => {
    const user = userEvent.setup();
    const nextSummary = deferred<string>();
    const nextRoster = deferred<string>();
    const summary = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("Old summary")
      .mockReturnValueOnce(nextSummary.promise);
    const roster = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("Old roster")
      .mockReturnValueOnce(nextRoster.promise);
    render(
      <PageRefreshProvider>
        <PageHeader title="Dashboard" action={<button>New report</button>} />
        <Resource loader={summary} />
        <section><Resource loader={roster} /></section>
      </PageRefreshProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByText("Old summary")).toBeInTheDocument();
    expect(screen.getByText("Old roster")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Refreshing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);

    await act(async () => nextSummary.resolve("New summary"));
    expect(screen.getByText("New summary")).toBeInTheDocument();
    expect(button).toBeDisabled();
    await act(async () => nextRoster.resolve("New roster"));
    expect(screen.getByText("New roster")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(summary).toHaveBeenCalledTimes(2);
    expect(roster).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "New report" })).toBeInTheDocument();
  });

  it("preserves data on failure and allows a successful retry", async () => {
    const user = userEvent.setup();
    const loader = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce("Saved data")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce("Updated data");
    render(
      <PageRefreshProvider>
        <PageHeader title="Reports" />
        <Resource loader={loader} />
      </PageRefreshProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByText("Saved data")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Updated data")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("respects unsaved-change protection without submitting a form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const loader = vi.fn().mockResolvedValue("Report");
    render(
      <PageRefreshProvider>
        <form onSubmit={submit}>
          <PageHeader title="Edit report" refreshDisabled refreshDisabledReason="Save your changes first." />
          <Resource loader={loader} />
        </form>
      </PageRefreshProvider>,
    );
    await screen.findByText("Report");
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "button");
    expect(screen.getByText("Save your changes first.")).toBeInTheDocument();
    await user.click(button);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("releases pending requests on unmount and ignores their late results", async () => {
    const pending = deferred<string>();
    const loader = vi.fn(() => pending.promise);
    const view = (visible: boolean) => (
      <PageRefreshProvider>
        <PageHeader title="Reports" />
        {visible && <Resource loader={loader} />}
      </PageRefreshProvider>
    );
    const { rerender } = render(view(true));
    expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    rerender(view(false));
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    await act(async () => pending.resolve("Stale response"));
    expect(screen.queryByText("Stale response")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });
});
