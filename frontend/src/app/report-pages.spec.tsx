import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageRefreshProvider } from "@/lib/page-refresh";
import type { Report } from "@/types";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  toast: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  submit: vi.fn(),
  getProjects: vi.fn(),
  getTeamReport: vi.fn(),
  approve: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
  useParams: () => ({ id: "first-report" }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/services/reports.api", () => ({
  reportsApi: {
    create: mocks.create,
    getById: mocks.getById,
    submit: mocks.submit,
  },
}));
vi.mock("@/services/projects.api", () => ({
  projectsApi: { getAll: mocks.getProjects },
}));
vi.mock("@/services/manager.api", () => ({
  managerApi: {
    getTeamReportById: mocks.getTeamReport,
    approve: mocks.approve,
  },
}));

// JSDOM has no layout engine for floating popovers. Keep form/picker logic real,
// while replacing only browser positioning and the calendar's visual surface.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ value, onChange, id }: { value?: string; onChange: (date: string) => void; id?: string }) => (
    <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

import NewReportPage from "./(member)/reports/new/page";
import ReportDetailPage from "./(member)/reports/[id]/page";
import ManagerReportDetailPage from "./(manager)/manager/reports/[id]/page";

const projectId = "11111111-1111-4111-8111-111111111111";
const draft: Report = {
  id: "first-report",
  userId: "first-member",
  projectId,
  weekStart: "2026-08-31",
  weekEnd: "2026-09-06",
  status: "DRAFT",
  notes: "First report",
  latestVersionNumber: 0,
  submittedAt: null,
  approvedAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  tasks: [],
  nextWeekTasks: [],
  blockers: [],
  achievements: [],
  workHours: [],
  versions: [],
  reviews: [],
};

describe("report page workflows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getProjects.mockResolvedValue({
      data: [
        {
          id: projectId,
          name: "First project",
          isActive: true,
          description: "",
        },
      ],
      meta: { page: 1, total: 1, limit: 20, totalPages: 1 },
    });
  });

  it("creates a first report through the actual form and project picker, then opens its detail page", async () => {
    const user = userEvent.setup();
    mocks.create.mockResolvedValue(draft);
    render(
      <PageRefreshProvider>
        <NewReportPage />
      </PageRefreshProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Select project" }));
    await user.click(
      await screen.findByRole("button", { name: "First project" }),
    );
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);
    await user.type(screen.getByLabelText("Task"), "My first task");
    await user.type(
      screen.getByLabelText("Notes and links"),
      "My first weekly update",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          notes: "My first weekly update",
          tasks: [
            expect.objectContaining({
              taskName: "My first task",
              status: "TODO",
            }),
          ],
        }),
      ),
    );
    expect(mocks.push).toHaveBeenCalledWith("/reports/first-report");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", title: "Draft created" }),
    );
  }, 15_000);

  it("retains a rejected draft and permits retry without navigating away", async () => {
    const user = userEvent.setup();
    mocks.create
      .mockRejectedValueOnce({
        response: {
          data: { message: "A weekly report already exists for this week." },
        },
      })
      .mockResolvedValueOnce(draft);
    render(<NewReportPage />);
    await user.type(
      screen.getByLabelText("Notes and links"),
      "Do not lose this text",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          description: "A weekly report already exists for this week.",
        }),
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Notes and links")).toHaveValue(
      "Do not lose this text",
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/reports/first-report"),
    );
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("removes obsolete draft actions after submission even if reloading fails", async () => {
    const user = userEvent.setup();
    const submitted: Report = {
      ...draft,
      status: "SUBMITTED",
      latestVersionNumber: 1,
    };
    mocks.getById
      .mockResolvedValueOnce(draft)
      .mockRejectedValueOnce(new Error("Reload unavailable"))
      .mockResolvedValueOnce(submitted);
    mocks.submit.mockResolvedValue(submitted);
    render(
      <PageRefreshProvider>
        <ReportDetailPage />
      </PageRefreshProvider>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Submit report" }),
    );
    const confirmation = screen.getByRole("alertdialog");
    await user.click(
      within(confirmation).getByRole("button", { name: "Submit report" }),
    );
    expect(await screen.findByText("Reload unavailable")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit report" }),
    ).not.toBeInTheDocument();
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Version 1")).toBeInTheDocument();
  });

  it("removes review actions after approval even if reloading fails", async () => {
    const user = userEvent.setup();
    const submitted: Report = {
      ...draft,
      status: "SUBMITTED",
      latestVersionNumber: 1,
    };
    mocks.getTeamReport
      .mockResolvedValueOnce(submitted)
      .mockRejectedValueOnce(new Error("Review reload unavailable"));
    mocks.approve.mockResolvedValue({ ...submitted, status: "APPROVED" });
    render(<ManagerReportDetailPage />);
    await user.click(
      await screen.findByRole("button", { name: "Approve report" }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Approve report",
      }),
    );
    expect(
      await screen.findByText("Review reload unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request changes" }),
    ).not.toBeInTheDocument();
  });
});
