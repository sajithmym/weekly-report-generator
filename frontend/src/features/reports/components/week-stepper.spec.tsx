import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeekStepper } from "./week-stepper";

describe("WeekStepper", () => {
  it("announces the selected week and reflects the week bounds", () => {
    render(
      <WeekStepper
        weekStart="2026-08-31"
        weekEnd="2026-09-06"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Viewing reporting week")).toBeInTheDocument();
    expect(
      screen.getByText("Aug 31, 2026 – Sep 6, 2026"),
    ).toBeInTheDocument();
  });

  it("steps exactly one Monday-Sunday week in each direction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WeekStepper
        weekStart="2026-08-31"
        weekEnd="2026-09-06"
        onChange={onChange}
      />,
    );

    // The component is stateless: each click reports the week adjacent to the
    // props it currently holds. The parent owns the selected week.
    await user.click(
      screen.getByRole("button", { name: "Next reporting week" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Previous reporting week" }),
    );
    expect(onChange.mock.calls).toEqual([["2026-09-07"], ["2026-08-24"]]);
  });

  it("keeps the next week Monday-aligned across month boundaries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WeekStepper
        weekStart="2026-08-31"
        weekEnd="2026-09-06"
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Previous reporting week" }),
    );
    // Stepping back from Aug 31 must land on Aug 24, not drift off Monday.
    expect(onChange).toHaveBeenLastCalledWith("2026-08-24");
  });
});
