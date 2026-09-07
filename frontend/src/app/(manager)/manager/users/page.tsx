"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Filter,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { authApi } from "@/services/auth.api";
import { useResource } from "@/lib/use-resource";
import {
  usersApi,
  type CreateUserPayload,
  type UserRole,
} from "@/services/users.api";
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
import { useToast } from "@/components/ui/toast";
import {
  PAGINATION_SETTINGS,
  USER_ROLES,
  VALIDATION_SETTINGS,
} from "@/lib/settings";
import { getErrorMessage } from "@/lib/utils";
import { USER_ROLE_LABELS } from "@/constants";
import type { PaginatedResponse, User } from "@/types";

type UserFilters = {
  search: string;
  role: "ALL" | UserRole;
  status: "ALL" | "ACTIVE" | "INACTIVE";
};
const DEFAULT_FILTERS: UserFilters = { search: "", role: "ALL", status: "ALL" };
const ROLE_OPTIONS = Object.values(USER_ROLES) as UserRole[];
const EMPTY_USER: CreateUserPayload = {
  name: "",
  email: "",
  password: "",
  role: USER_ROLES.TEAM_MEMBER,
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserFieldErrors = {
  name?: string;
  email?: string;
  password?: string;
};

export default function ManagerUsersPage() {
  const { toast } = useToast();
  const {
    data: currentUser,
    error: currentUserError,
    reload: fetchCurrentUser,
  } = useResource(authApi.getMe);
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<UserFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState<number>(PAGINATION_SETTINGS.defaultPage);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserPayload>(EMPTY_USER);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<UserFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [statusUser, setStatusUser] = useState<User | null>(null);
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    USER_ROLES.TEAM_MEMBER,
  );
  const [roleChange, setRoleChange] = useState<{
    user: User;
    role: UserRole;
  } | null>(null);
  const [updating, setUpdating] = useState(false);
  const isAdmin = currentUser?.role === USER_ROLES.ADMIN;

  const loader = useCallback(
    () =>
      usersApi.getAll({
        page,
        limit: PAGINATION_SETTINGS.defaultLimit,
        search: appliedFilters.search.trim() || undefined,
        role: appliedFilters.role === "ALL" ? undefined : appliedFilters.role,
        isActive:
          appliedFilters.status === "ALL"
            ? undefined
            : appliedFilters.status === "ACTIVE",
      }),
    [page, appliedFilters],
  );
  const { data, loading, error, reload: fetchUsers } = useResource(loader);

  const createUser = async () => {
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    const nextErrors: UserFieldErrors = {};
    if (name.length < VALIDATION_SETTINGS.name.min) {
      nextErrors.name = `Full name must contain at least ${VALIDATION_SETTINGS.name.min} characters.`;
    } else if (name.length > VALIDATION_SETTINGS.name.max) {
      nextErrors.name = `Full name must contain at most ${VALIDATION_SETTINGS.name.max} characters.`;
    }
    if (!email) {
      nextErrors.email = "Email address is required.";
    } else if (email.length > VALIDATION_SETTINGS.email.max) {
      nextErrors.email = `Email address must contain at most ${VALIDATION_SETTINGS.email.max} characters.`;
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (newUser.password.length < VALIDATION_SETTINGS.password.min) {
      nextErrors.password = `Password must be at least ${VALIDATION_SETTINGS.password.min} characters.`;
    } else if (newUser.password.length > VALIDATION_SETTINGS.password.max) {
      nextErrors.password = `Password must be at most ${VALIDATION_SETTINGS.password.max} characters.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await usersApi.create({ ...newUser, name, email });
      toast({
        variant: "success",
        title: "User created",
        description: `${name} can now sign in with the assigned role.`,
      });
      setNewUser(EMPTY_USER);
      setCreateOpen(false);
      fetchUsers();
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setFormError(message);
      toast({
        variant: "error",
        title: "Could not create user",
        description: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async () => {
    if (!statusUser) return;
    setUpdating(true);
    try {
      await usersApi.updateStatus(statusUser.id, !statusUser.isActive);
      toast({
        variant: "success",
        title: `User ${statusUser.isActive ? "deactivated" : "activated"}`,
        description: `${statusUser.name}'s access has been updated.`,
      });
      setStatusUser(null);
      fetchUsers();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not update access",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setUpdating(false);
    }
  };

  const updateRole = async () => {
    if (!roleChange) return;
    setUpdating(true);
    try {
      await usersApi.updateRole(roleChange.user.id, roleChange.role);
      toast({
        variant: "success",
        title: "Role updated",
        description: `${roleChange.user.name} is now a ${USER_ROLE_LABELS[roleChange.role]}.`,
      });
      setRoleChange(null);
      fetchUsers();
    } catch (error) {
      toast({
        variant: "error",
        title: "Could not update role",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setUpdating(false);
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
  const users = data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        refreshDisabled={saving || updating || createOpen || Boolean(statusUser || roleDialogUser || roleChange)}
        title={isAdmin ? "User Management" : "Team Members"}
        description={
          isAdmin
            ? "Manage user access, roles, and active accounts."
            : "View team members and their report activity."
        }
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setFormError(null);
                setFieldErrors({});
                setNewUser(EMPTY_USER);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New user
            </Button>
          ) : undefined
        }
      />
      {currentUserError && <ErrorState message={currentUserError} onRetry={fetchCurrentUser} />}
      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="user-search">Search users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="user-search"
                className="pl-9"
                value={filters.search}
                onChange={(event) =>
                  setFilters({ ...filters, search: event.target.value })
                }
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
                placeholder="Search by name or email"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={filters.role}
              onValueChange={(role: UserFilters["role"]) =>
                setFilters({ ...filters, role })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles</SelectItem>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account status</Label>
            <Select
              value={filters.status}
              onValueChange={(status: UserFilters["status"]) =>
                setFilters({ ...filters, status })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Pending activation</SelectItem>
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
            disabled={
              filters.search === "" &&
              filters.role === "ALL" &&
              filters.status === "ALL"
            }
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </CardContent>
      </Card>
      {loading ? (
        <LoadingState message="Loading users..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try different filters to find a team member."
          action={
            isAdmin ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create user
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.meta.total || 0} user{data?.meta.total === 1 ? "" : "s"}{" "}
              found
            </span>
            <span>
              Page {data?.meta.page} of {data?.meta.totalPages}
            </span>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          user.role === USER_ROLES.MANAGER ||
                          user.role === USER_ROLES.ADMIN
                            ? "default"
                            : "secondary"
                        }
                      >
                        {USER_ROLE_LABELS[user.role]}
                      </Badge>
                      <Badge
                        variant={user.isActive ? "success" : "destructive"}
                      >
                        {user.isActive ? "Active" : "Pending activation"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {user._count?.reports || 0} reports
                      </span>
                    </div>
                  </div>
                  {isAdmin && user.id !== currentUser?.id && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRoleDialogUser(user);
                          setSelectedRole(user.role);
                        }}
                      >
                        <UserCog className="mr-1.5 h-4 w-4" />
                        Change role
                      </Button>
                      <Button
                        variant={user.isActive ? "destructive" : "secondary"}
                        size="sm"
                        onClick={() => setStatusUser(user)}
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4" />
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Create a user account and assign their initial role. The user can
              sign in immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={newUser.name}
                onChange={(event) => {
                  setNewUser({ ...newUser, name: event.target.value });
                  if (fieldErrors.name)
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                maxLength={VALIDATION_SETTINGS.name.max}
                aria-invalid={Boolean(fieldErrors.name)}
                autoFocus
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email address</Label>
              <Input
                id="user-email"
                type="email"
                value={newUser.email}
                onChange={(event) => {
                  setNewUser({ ...newUser, email: event.target.value });
                  if (fieldErrors.email)
                    setFieldErrors((current) => ({
                      ...current,
                      email: undefined,
                    }));
                }}
                maxLength={VALIDATION_SETTINGS.email.max}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Temporary password</Label>
              <Input
                id="user-password"
                type="password"
                value={newUser.password}
                onChange={(event) => {
                  setNewUser({ ...newUser, password: event.target.value });
                  if (fieldErrors.password)
                    setFieldErrors((current) => ({
                      ...current,
                      password: undefined,
                    }));
                }}
                maxLength={VALIDATION_SETTINGS.password.max}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(role: UserRole) =>
                  setNewUser({ ...newUser, role })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {USER_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={createUser} disabled={saving}>
              {saving ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(roleDialogUser)}
        onOpenChange={(open) => !open && setRoleDialogUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Select the permissions for {roleDialogUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New role</Label>
            <Select
              value={selectedRole}
              onValueChange={(role: UserRole) => setSelectedRole(role)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !roleDialogUser || selectedRole === roleDialogUser.role
              }
              onClick={() => {
                if (roleDialogUser && selectedRole !== roleDialogUser.role) {
                  setRoleChange({ user: roleDialogUser, role: selectedRole });
                  setRoleDialogUser(null);
                }
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(statusUser)}
        onOpenChange={(open) => !open && setStatusUser(null)}
        title={`${statusUser?.isActive ? "Deactivate" : "Activate"} user?`}
        description={
          statusUser?.isActive
            ? `${statusUser.name} will no longer be able to sign in. Their reports and history remain protected.`
            : `${statusUser?.name} will be able to sign in after activation.`
        }
        confirmLabel={
          statusUser?.isActive ? "Deactivate user" : "Activate user"
        }
        variant={statusUser?.isActive ? "destructive" : "default"}
        loading={updating}
        onConfirm={updateStatus}
      />
      <ConfirmationDialog
        open={Boolean(roleChange)}
        onOpenChange={(open) => !open && setRoleChange(null)}
        title="Change user role?"
        description={
          roleChange
            ? `${roleChange.user.name} will become a ${USER_ROLE_LABELS[roleChange.role]}. This changes the features they can access.`
            : ""
        }
        confirmLabel="Update role"
        loading={updating}
        onConfirm={updateRole}
      />
    </div>
  );
}
