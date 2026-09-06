"use client";

import { useEffect, useState, useCallback } from "react";
import { Archive, Edit3, Filter, Plus, RotateCcw, Search } from "lucide-react";
import { useResource } from "@/lib/use-resource";
import { projectsApi } from "@/services/projects.api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { PAGINATION_SETTINGS } from "@/lib/settings";
import { getErrorMessage } from "@/lib/utils";
import type { PaginatedResponse, Project } from "@/types";

type ProjectForm = { name: string; description: string };
type ProjectFilters = { search: string; status: "ALL" | "ACTIVE" | "ARCHIVED" };

const EMPTY_PROJECT_FORM: ProjectForm = { name: "", description: "" };
const DEFAULT_FILTERS: ProjectFilters = { search: "", status: "ALL" };

export default function ManagerProjectsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<ProjectFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState<number>(PAGINATION_SETTINGS.defaultPage);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] =
    useState<ProjectForm>(EMPTY_PROJECT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusProject, setStatusProject] = useState<Project | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loader = useCallback(
    () =>
      projectsApi.getAll({
        page,
        limit: PAGINATION_SETTINGS.defaultLimit,
        search: appliedFilters.search.trim() || undefined,
        isActive:
          appliedFilters.status === "ALL"
            ? undefined
            : appliedFilters.status === "ACTIVE",
      }),
    [page, appliedFilters],
  );
  const { data, loading, error, reload: fetchProjects } = useResource(loader);

  const openCreateDialog = () => {
    setEditingProject(null);
    setProjectForm(EMPTY_PROJECT_FORM);
    setFormError(null);
    setFormOpen(true);
  };
  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const saveProject = async () => {
    const name = projectForm.name.trim();
    if (name.length < 2) {
      setFormError("Project name must contain at least 2 characters.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name, description: projectForm.description.trim() };
      if (editingProject) {
        await projectsApi.update(editingProject.id, payload);
        toast({
          variant: "success",
          title: "Project updated",
          description: `${name} is up to date.`,
        });
      } else {
        await projectsApi.create(payload);
        toast({
          variant: "success",
          title: "Project created",
          description: `${name} is ready to use in weekly reports.`,
        });
      }
      setFormOpen(false);
      fetchProjects();
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setFormError(message);
      toast({
        variant: "error",
        title: `Could not ${editingProject ? "update" : "create"} project`,
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateProjectStatus = async () => {
    if (!statusProject) return;
    setUpdatingStatus(true);
    try {
      if (statusProject.isActive) {
        await projectsApi.remove(statusProject.id);
        toast({
          variant: "success",
          title: "Project archived",
          description: `${statusProject.name} remains available in historical reports.`,
        });
      } else {
        await projectsApi.update(statusProject.id, { isActive: true });
        toast({
          variant: "success",
          title: "Project reactivated",
          description: `${statusProject.name} can be selected in new reports again.`,
        });
      }
      setStatusProject(null);
      fetchProjects();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not update project",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const applyFilters = () => {
    setPage(PAGINATION_SETTINGS.defaultPage);
    setAppliedFilters(filters);
  };
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(PAGINATION_SETTINGS.defaultPage);
    setAppliedFilters(DEFAULT_FILTERS);
  };
  const projects = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        refreshDisabled={saving || updatingStatus || formOpen || Boolean(statusProject)}
        title="Project Management"
        description="Create, update, archive, and restore projects without losing report history."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_auto_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="project-search">Search projects</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="project-search"
                className="pl-9"
                value={filters.search}
                onChange={(event) =>
                  setFilters({ ...filters, search: event.target.value })
                }
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                placeholder="Search by project name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project status</Label>
            <Select
              value={filters.status}
              onValueChange={(status: ProjectFilters["status"]) =>
                setFilters({ ...filters, status })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={applyFilters}>
            <Filter className="mr-2 h-4 w-4" />
            Apply
          </Button>
          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={filters.search === "" && filters.status === "ALL"}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>
      {loading ? (
        <LoadingState message="Loading projects..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Try different filters or create a project to get started."
          action={
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create project
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.meta.total || 0} project{data?.meta.total === 1 ? "" : "s"}{" "}
              found
            </span>
            <span>
              Page {data?.meta.page} of {data?.meta.totalPages}
            </span>
          </div>
          <div className="space-y-3">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{project.name}</p>
                      <Badge
                        variant={project.isActive ? "success" : "secondary"}
                      >
                        {project.isActive ? "Active" : "Archived"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.description || "No description provided."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(project)}
                    >
                      <Edit3 className="mr-1.5 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant={project.isActive ? "destructive" : "secondary"}
                      size="sm"
                      onClick={() => setStatusProject(project)}
                    >
                      {project.isActive ? (
                        <Archive className="mr-1.5 h-4 w-4" />
                      ) : (
                        <RotateCcw className="mr-1.5 h-4 w-4" />
                      )}
                      {project.isActive ? "Archive" : "Reactivate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {(data?.meta.totalPages || 0) > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setPage((current) => current - 1)}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data?.meta.page} of {data?.meta.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= (data?.meta.totalPages || 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit project" : "Create project"}
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update project details. Changes are reflected throughout the application."
                : "Add a project for team members to use in their weekly reports."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={projectForm.name}
                onChange={(event) =>
                  setProjectForm({ ...projectForm, name: event.target.value })
                }
                placeholder="e.g. Client Portal"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm({
                    ...projectForm,
                    description: event.target.value,
                  })
                }
                placeholder="What is this project for?"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveProject} disabled={saving}>
              {saving
                ? "Saving..."
                : editingProject
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(statusProject)}
        onOpenChange={(open) => !open && setStatusProject(null)}
        title={`${statusProject?.isActive ? "Archive" : "Reactivate"} project?`}
        description={
          statusProject?.isActive
            ? `${statusProject.name} will no longer be selectable in new reports. Existing reports will be preserved.`
            : `${statusProject?.name} will be available in new and editable reports again.`
        }
        confirmLabel={
          statusProject?.isActive ? "Archive project" : "Reactivate project"
        }
        variant={statusProject?.isActive ? "destructive" : "default"}
        loading={updatingStatus}
        onConfirm={updateProjectStatus}
      />
    </div>
  );
}
