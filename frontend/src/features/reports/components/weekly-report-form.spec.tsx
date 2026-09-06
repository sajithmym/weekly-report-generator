import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeeklyReportForm } from "./weekly-report-form";
import type { Report } from "@/types";

vi.mock("@/components/shared/entity-picker", () => ({
  EntityPicker: ({
    value,
    emptyLabel,
    onChange,
    id,
  }: {
    value: string;
    emptyLabel: string;
    onChange: (value: string) => void;
    id?: string;
  }) => (
    <button
      id={id}
      type="button"
      onClick={() => onChange("11111111-1111-4111-8111-111111111111")}
    >
      {value || emptyLabel}
    </button>
  ),
}));

vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({
    onChange,
    id,
  }: {
    onChange: (date?: Date) => void;
    id?: string;
  }) => (
    <button
      id={id}
      type="button"
      onClick={() => onChange(new Date("2026-09-06T12:00:00"))}
    >
      Choose reporting week
    </button>
  ),
}));

describe("WeeklyReportForm", () => {
  function renderForm(
    overrides?: Partial<React.ComponentProps<typeof WeeklyReportForm>>,
  ) {
    const props = {
      submitLabel: "Save draft",
      saving: false,
      onSave: vi.fn().mockResolvedValue(undefined),
      onCancel: vi.fn(),
      ...overrides,
    };

    render(<WeeklyReportForm {...props} />);
    return props;
  }

  it("updates the reporting week and runs the cancel handler", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();

    expect(screen.getByText("No project selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Week start" }));

    expect(screen.getByLabelText("Week end")).toHaveValue("2026-09-06");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("associates visible labels with report controls", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("Project")).toHaveAttribute(
      "id",
      "report-project",
    );
    expect(screen.getByLabelText("Week start")).toHaveAttribute(
      "id",
      "report-week-start",
    );
    expect(screen.getByLabelText("Week end")).toHaveAttribute(
      "id",
      "report-week-end",
    );
    expect(screen.getByLabelText("Notes and links")).toHaveAttribute(
      "id",
      "report-notes",
    );

    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);

    expect(screen.getByLabelText("Task")).toHaveAttribute("id");
    expect(screen.getByLabelText("Priority")).toHaveAttribute("id");
    expect(screen.getByLabelText("Status")).toHaveAttribute("id");
    expect(screen.getByLabelText("Planned %")).toHaveAttribute("id");
    expect(screen.getByLabelText("Deliverable")).toHaveAttribute("id");
  });

  it("submits a valid report with normalized project data", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(screen.getByRole("button", { name: "Project" }));
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);
    await user.type(
      screen.getByPlaceholderText("Task name"),
      "Publish dashboard",
    );
    await user.type(
      screen.getByPlaceholderText(
        "Add context, decisions, risks, or relevant links.",
      ),
      "Release notes are ready.",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "11111111-1111-4111-8111-111111111111",
          notes: "Release notes are ready.",
          tasks: [
            expect.objectContaining({
              taskName: "Publish dashboard",
              priority: "MEDIUM",
              status: "TODO",
              plannedMinutes: 0,
              actualMinutes: 0,
            }),
          ],
        }),
      ),
    );
  }, 15_000);

  it("keeps only the most recently selected blocker as the key issue", async () => {
    const user = userEvent.setup();
    renderForm();

    const addButtons = screen.getAllByRole("button", { name: "Add" });
    await user.click(addButtons[2]);
    await user.click(addButtons[2]);

    const keyIssueBoxes = screen.getAllByRole("checkbox", {
      name: "Key issue",
    });
    await user.click(keyIssueBoxes[0]);
    await user.click(keyIssueBoxes[1]);

    expect(keyIssueBoxes[0]).not.toBeChecked();
    expect(keyIssueBoxes[1]).toBeChecked();
  });

  it("disables actions and makes the in-progress state clear while saving", () => {
    renderForm({ saving: true });

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Notes and links")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Project" })).toBeDisabled();
  });

  it("prevents repeated form submissions and preserves inputs when a save fails", async () => {
    const user = userEvent.setup();
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_resolve, fail) => {
      reject = fail;
    });
    const onSave = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(undefined);
    renderForm({ onSave });
    await user.type(screen.getByLabelText("Notes and links"), "Keep my draft");
    const form = screen.getByRole("form", { name: "Weekly report" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByLabelText("Notes and links")).toBeDisabled();
    await act(async () => reject(new Error("Network unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
    expect(screen.getByLabelText("Notes and links")).toHaveValue(
      "Keep my draft",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: null,
        notes: "Keep my draft",
        tasks: [],
      }),
    );
  });

  it("uses the current reporting week when a new form opens after a week boundary", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-06T23:59:00Z"));
      const props = {
        submitLabel: "Save draft",
        saving: false,
        onSave: vi.fn(),
        onCancel: vi.fn(),
      };
      const first = render(<WeeklyReportForm {...props} />);
      expect(screen.getByLabelText("Week end")).toHaveValue("2026-09-06");
      first.unmount();
      vi.setSystemTime(new Date("2026-09-07T00:01:00Z"));
      render(<WeeklyReportForm {...props} />);
      expect(screen.getByLabelText("Week end")).toHaveValue("2026-09-13");
    } finally {
      vi.useRealTimers();
    }
  });

  it("saves all sections and renumbers next-week tasks after removing an entry", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    const add = screen.getAllByRole("button", { name: "Add" });
    await user.click(add[0]);
    await user.type(screen.getByLabelText("Task"), "First feature");
    await user.click(add[1]);
    await user.click(add[1]);
    await user.type(screen.getByLabelText("Task 1"), "Remove this");
    await user.type(screen.getByLabelText("Task 2"), "Keep this");
    // The first removal control belongs to the current-week task.
    await user.click(screen.getAllByRole("button", { name: "Remove item" })[1]);
    await user.click(add[1]);
    await user.type(screen.getByLabelText("Task 2"), "Then this");
    await user.click(add[2]);
    await user.type(screen.getByLabelText("Blocker"), "Awaiting access");
    await user.click(screen.getByRole("checkbox", { name: "Key issue" }));
    await user.click(add[3]);
    await user.type(screen.getByLabelText("Achievement"), "First delivery");
    await user.click(screen.getByRole("checkbox", { name: "Key achievement" }));
    await user.click(add[4]);
    await user.clear(screen.getByLabelText("Minutes"));
    await user.type(screen.getByLabelText("Minutes"), "90");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: [
            expect.objectContaining({
              taskName: "First feature",
              status: "TODO",
            }),
          ],
          nextWeekTasks: [
            { description: "Keep this", sortOrder: 0 },
            { description: "Then this", sortOrder: 1 },
          ],
          blockers: [
            {
              description: "Awaiting access",
              isKeyIssue: true,
              isResolved: false,
            },
          ],
          achievements: [
            { description: "First delivery", isKeyAchievement: true },
          ],
          workHours: [{ type: "DEVELOPMENT", minutes: 90 }],
        }),
      ),
    );
  }, 15_000);

  it("marks custom picker changes as unsaved", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderForm({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Project" }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("applies refreshed report data only while the editor has no unsaved changes", async () => {
    const user = userEvent.setup();
    const report: Report = {
      id: "report-1",
      userId: "member-1",
      projectId: null,
      weekStart: "2026-08-31",
      weekEnd: "2026-09-06",
      status: "DRAFT",
      notes: "Original notes",
      latestVersionNumber: 0,
      submittedAt: null,
      approvedAt: null,
      createdAt: "2026-08-31T00:00:00Z",
      updatedAt: "2026-08-31T00:00:00Z",
    };
    const props = {
      submitLabel: "Save changes",
      saving: false,
      onSave: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(
      <WeeklyReportForm {...props} initialReport={report} />,
    );
    rerender(
      <WeeklyReportForm
        {...props}
        initialReport={{ ...report, notes: "Refreshed notes" }}
      />,
    );
    expect(screen.getByLabelText("Notes and links")).toHaveValue(
      "Refreshed notes",
    );

    await user.type(
      screen.getByLabelText("Notes and links"),
      " with local edits",
    );
    rerender(
      <WeeklyReportForm
        {...props}
        initialReport={{ ...report, notes: "Later server notes" }}
      />,
    );
    expect(screen.getByLabelText("Notes and links")).toHaveValue(
      "Refreshed notes with local edits",
    );
  });
});
