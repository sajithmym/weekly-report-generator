import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  setAccessToken: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  default: {
    get: api.get,
    post: api.post,
    patch: api.patch,
    delete: api.delete,
  },
  setAccessToken: api.setAccessToken,
  clearSession: api.clearSession,
}));

import { authApi } from "./auth.api";
import { managerApi } from "./manager.api";
import { projectsApi } from "./projects.api";
import { reportsApi } from "./reports.api";
import { usersApi } from "./users.api";

const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
const response = (data: unknown, responseMeta?: typeof meta) => ({
  data: { data, ...(responseMeta ? { meta: responseMeta } : {}) },
});

describe("frontend API services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps auth responses, stores access tokens, and always clears local state on logout", async () => {
    const auth = { accessToken: "access-token", user: { id: "user-1" } };
    api.post
      .mockResolvedValueOnce(response({ user: { id: "pending" } }))
      .mockResolvedValueOnce(response(auth))
      .mockResolvedValueOnce(response({ accessToken: "refreshed-token" }))
      .mockRejectedValueOnce(new Error("network unavailable"));

    await expect(
      authApi.register({ name: "Asha", email: "asha@example.com", password: "password123" }),
    ).resolves.toEqual({ user: { id: "pending" } });
    await expect(
      authApi.login({ email: "asha@example.com", password: "password123" }),
    ).resolves.toEqual(auth);
    await expect(authApi.refresh()).resolves.toEqual({ accessToken: "refreshed-token" });
    await expect(authApi.logout()).rejects.toThrow("network unavailable");

    expect(api.post).toHaveBeenNthCalledWith(1, "/auth/register", {
      name: "Asha",
      email: "asha@example.com",
      password: "password123",
    });
    expect(api.setAccessToken).toHaveBeenNthCalledWith(1, "access-token");
    expect(api.setAccessToken).toHaveBeenNthCalledWith(2, "refreshed-token");
    expect(api.clearSession).toHaveBeenCalledOnce();
  });

  it("uses the correct personal report endpoints and preserves list metadata", async () => {
    const report = { id: "report-1", status: "DRAFT" };
    api.get
      .mockResolvedValueOnce(response({ DRAFT: 2 }))
      .mockResolvedValueOnce(response([report], meta))
      .mockResolvedValueOnce(response(report))
      .mockResolvedValueOnce(response([{ id: "version-1" }]));
    api.post.mockResolvedValueOnce(response(report)).mockResolvedValueOnce(response(report));
    api.patch.mockResolvedValueOnce(response(report));

    await expect(reportsApi.getMySummary()).resolves.toEqual({ DRAFT: 2 });
    await expect(reportsApi.getMyReports({ page: 2, limit: 10 })).resolves.toEqual({
      data: [report],
      meta,
    });
    await expect(
      reportsApi.create({
        weekStart: "2026-08-31",
        weekEnd: "2026-09-06",
        projectId: "11111111-1111-4111-8111-111111111111",
        notes: "Draft",
        tasks: [
          {
            taskName: "Deliver feature",
            priority: "MEDIUM" as const,
            plannedPercentage: 0,
            actualPercentage: 0,
            status: "TODO" as const,
            plannedMinutes: 0,
            actualMinutes: 0,
          },
        ],
        nextWeekTasks: [],
        blockers: [],
        achievements: [],
        workHours: [],
      }),
    ).resolves.toEqual(report);
    await expect(reportsApi.getById("report-1")).resolves.toEqual(report);
    await expect(reportsApi.update("report-1", { notes: "Updated" })).resolves.toEqual(report);
    await expect(reportsApi.submit("report-1")).resolves.toEqual(report);
    await expect(reportsApi.getVersions("report-1")).resolves.toEqual([{ id: "version-1" }]);

    expect(api.get).toHaveBeenNthCalledWith(2, "/reports/my", {
      params: { page: 2, limit: 10 },
    });
    expect(api.post).toHaveBeenNthCalledWith(2, "/reports/report-1/submit");
    expect(api.patch).toHaveBeenCalledWith("/reports/report-1", { notes: "Updated" });
  });

  it("uses project and user CRUD endpoints with caller-provided filters", async () => {
    const project = { id: "project-1", name: "Client Portal" };
    const user = { id: "user-1", name: "Asha", role: "TEAM_MEMBER" };
    api.get
      .mockResolvedValueOnce(response([project], meta))
      .mockResolvedValueOnce(response(project))
      .mockResolvedValueOnce(response([user], meta))
      .mockResolvedValueOnce(response(user));
    api.post.mockResolvedValueOnce(response(project)).mockResolvedValueOnce(response(user));
    api.patch
      .mockResolvedValueOnce(response(project))
      .mockResolvedValueOnce(response(user))
      .mockResolvedValueOnce(response(user));
    api.delete.mockResolvedValueOnce(response(null));

    await expect(projectsApi.getAll({ search: "client", isActive: true })).resolves.toEqual({
      data: [project],
      meta,
    });
    await expect(projectsApi.getById(project.id)).resolves.toEqual(project);
    await projectsApi.create({ name: project.name });
    await projectsApi.update(project.id, { name: "Renamed" });
    await expect(projectsApi.remove(project.id)).resolves.toBeUndefined();
    await expect(usersApi.getAll({ role: "TEAM_MEMBER", isActive: true })).resolves.toEqual({
      data: [user],
      meta,
    });
    await expect(usersApi.getById(user.id)).resolves.toEqual(user);
    await usersApi.create({ name: "Asha", email: "asha@example.com", password: "password123" });
    await usersApi.updateRole(user.id, "MANAGER");
    await usersApi.updateStatus(user.id, false);

    expect(api.get).toHaveBeenNthCalledWith(1, "/projects", {
      params: { search: "client", isActive: true },
    });
    expect(api.delete).toHaveBeenCalledWith("/projects/project-1");
    expect(api.patch).toHaveBeenNthCalledWith(2, "/users/user-1/role", {
      role: "MANAGER",
    });
    expect(api.patch).toHaveBeenNthCalledWith(3, "/users/user-1/status", {
      isActive: false,
    });
  });

  it("maps manager report, roster, and all dashboard API contracts", async () => {
    api.get.mockResolvedValue(response([], meta));
    api.post.mockResolvedValue(response(null));

    await managerApi.getRoster({ weekStart: "2026-08-31", status: "PENDING" });
    await managerApi.getTeamReports({ status: "SUBMITTED" });
    await managerApi.getTeamReportById("report-1");
    await managerApi.requestChanges("report-1", "Please revise");
    await managerApi.approve("report-1");
    await managerApi.getSummary("2026-08-31", "2026-09-06");
    await managerApi.getStatusDistribution("2026-08-31", "2026-09-06");
    await managerApi.getTaskTrends(8, "2026-09-06");
    await managerApi.getProjectWorkload("2026-08-31", "2026-09-06");
    await managerApi.getTimeDistribution("2026-08-31", "2026-09-06");
    await managerApi.getRecentActivity(10, "2026-08-31", "2026-09-06");

    expect(api.get).toHaveBeenNthCalledWith(1, "/manager/dashboard/roster", {
      params: { weekStart: "2026-08-31", status: "PENDING" },
    });
    expect(api.get).toHaveBeenNthCalledWith(3, "/manager/reports/report-1");
    expect(api.post).toHaveBeenNthCalledWith(1, "/manager/reports/report-1/request-changes", {
      comment: "Please revise",
    });
    expect(api.post).toHaveBeenNthCalledWith(2, "/manager/reports/report-1/approve");
    expect(api.get).toHaveBeenNthCalledWith(5, "/manager/dashboard/status-distribution", {
      params: { weekStart: "2026-08-31", weekEnd: "2026-09-06" },
    });
    expect(api.get).toHaveBeenLastCalledWith("/manager/dashboard/activity", {
      params: { limit: 10, weekStart: "2026-08-31", weekEnd: "2026-09-06" },
    });
  });
});
