import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";
import { UI_SETTINGS } from "@/lib/settings";

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ variant: "success", title: "Saved" })}>
      Show toast
    </button>
  );
}

describe("ToastProvider", () => {
  it("dismisses a toast after the configured duration", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastTrigger />
        </ToastProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Show toast" }));
      expect(screen.getByText("Saved")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(UI_SETTINGS.toast.durationMs));
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
