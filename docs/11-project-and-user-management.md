# Project and user management

## Projects

Authenticated users can read active projects for report selection. Managers/admins create, update, archive, and reactivate projects. `DELETE /api/v1/projects/:id` soft-archives a project; it does not destroy historical report relationships. A patch can reactivate an archived project.

`user_projects` is present for future membership rules but is not currently used to restrict report project selection or visibility. Do not describe project-membership enforcement as implemented.

## Users

Managers/admins can list and view users. Only admins can create a user, change role, or activate/deactivate an account. Managers receive a server-side forbidden response for these changes even if they alter UI requests.

Self-registration is configurable and creates a pending account. Pending/inactive users cannot authenticate. Current role and active state are loaded for protected requests, so administrator changes apply immediately. Lists use validated pagination/filtering and never return refresh-token data.
