# Current Project Reference

This is the cross-cutting source of truth for the Weekly Report Generator as implemented in this repository. The numbered guides and both subfolders provide detailed, feature-specific companion documentation.

## Scope and architecture

The application is an internal weekly-report system with a Next.js 16 frontend, a NestJS 11 API, Prisma 5, and PostgreSQL 14+. The frontend is a client-rendered Next.js App Router application. The API is served beneath `/api/v1`; Prisma owns the relational data model and committed migration history.

- Frontend: `frontend/`, TypeScript, React Hook Form, Zod, Tailwind, Radix UI, Recharts, Axios, Vitest and Testing Library.
- Backend: `backend/`, NestJS modules, DTO validation, Prisma, PostgreSQL, JWT, Jest, and Supertest.
- Local database: provide a locally installed or otherwise reachable PostgreSQL server and configure it through `backend/.env`.
- Required runtime for the whole repository: Node.js 24 or later. The backend enforces `>=24.0.0`; the frontend itself supports `>=20.9.0`.

## Roles and permissions

| Capability | TEAM_MEMBER | MANAGER | ADMIN |
|---|---:|---:|---:|
| Register a pending account | Yes, when enabled | Yes, when enabled | Yes, when enabled |
| View active projects | Yes | Yes | Yes |
| Create, edit, submit, view, and list own reports | Yes | No | No |
| Read other members' reports or drafts | No | Submitted/corrected/approved reports; other users' drafts remain private | Same as Manager |
| Review a submitted report | No | Approve or request changes | Approve or request changes |
| View manager dashboard, roster, and team reports | No | Yes | Yes |
| Create, update, archive, or restore projects | No | Yes | Yes |
| List and view users | No | Yes, read-only | Yes |
| Create users, change roles, activate/deactivate users | No | No | Yes |

The frontend redirects users to the appropriate role area for usability. The NestJS guards and service ownership checks are the security boundary. A JWT is rehydrated from the current user record on every protected request, so current role and active-account state apply immediately.

## Reporting workflow and data rules

A report belongs to one team member and one Monday-to-Sunday UTC reporting week. The database enforces one report per member/week. The form supports an optional active project, task entries, next-week tasks, blockers, achievements, work hours, and notes.

```text
DRAFT -> SUBMITTED -> APPROVED
                  \-> NEEDS_CORRECTION -> SUBMITTED
```

Only the author may edit a `DRAFT` or `NEEDS_CORRECTION` report. Drafts may be incomplete; submission requires a selected project and at least one named task. Task status does not need to be `DONE`. The form and report view label this section "Tasks and progress" to include unfinished work. A manager or admin may approve or request changes only while the report is `SUBMITTED`; change requests require a comment. Each submission creates an immutable full-content version snapshot, and reviews are linked to the version they acted on.

Dashboard reporting uses Monday-Sunday UTC weeks. Managers and administrators may see draft status/count metadata for compliance, but never draft content or private draft report IDs. Compliance counts member-weeks that have been submitted at least once; approval and correction do not remove that credit. `PENDING` means no report has been submitted for the selected week; `LATE` includes overdue missing reports and reports first submitted after the Sunday 23:59:59 UTC deadline.

## API

All API responses use `{ success, statusCode, message, data, timestamp, code? }`. Paginated responses additionally contain `meta` with `page`, `limit`, `total`, and `totalPages`.

| Area | Routes |
|---|---|
| Health | `GET /api/v1/health` (returns `503 SERVICE_UNAVAILABLE` if PostgreSQL is unavailable) |
| Authentication | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` |
| Member reports | `POST /api/v1/reports`, `GET /api/v1/reports/my`, `GET /api/v1/reports/my/summary`, `GET /api/v1/reports/:id`, `PATCH /api/v1/reports/:id`, `POST /api/v1/reports/:id/submit`, `GET /api/v1/reports/:id/versions` |
| Manager reports | `GET /api/v1/manager/reports`, `GET /api/v1/manager/reports/:id`, `POST /api/v1/manager/reports/:id/request-changes`, `POST /api/v1/manager/reports/:id/approve` |
| Manager dashboard | `GET /api/v1/manager/dashboard/roster`, `GET /api/v1/manager/dashboard/summary`, `GET /api/v1/manager/dashboard/status-distribution`, `GET /api/v1/manager/dashboard/task-trends`, `GET /api/v1/manager/dashboard/project-workload`, `GET /api/v1/manager/dashboard/time-distribution`, `GET /api/v1/manager/dashboard/activity` |
| Projects | `GET /api/v1/projects`, `GET /api/v1/projects/:id`, `POST /api/v1/projects`, `PATCH /api/v1/projects/:id`, `DELETE /api/v1/projects/:id` |
| Users | `GET /api/v1/users`, `GET /api/v1/users/:id`, `POST /api/v1/users`, `PATCH /api/v1/users/:id/role`, `PATCH /api/v1/users/:id/status` |

The `DELETE /projects/:id` endpoint is a soft delete: it marks the project inactive. `PATCH /projects/:id` can reactivate it. Query filters are validated by DTOs; list endpoints accept pagination and documented filters used by the frontend.

## Database and migrations

The Prisma schema is `backend/prisma/schema.prisma`. The committed baseline migration is `20260905000000_initial`; `backend/prisma/migrations/migration_lock.toml` declares PostgreSQL. Apply the schema with `npx prisma migrate deploy`; do not use `migrate dev` in production.

Tables: `users`, `projects`, `user_projects`, `reports`, `report_tasks`, `next_week_tasks`, `blockers`, `achievements`, `work_hours`, `report_versions`, `reviews`, and `refresh_tokens`. `user_projects` is present in the schema for future project-membership support; current report selection is limited to active projects but does not use membership rules.

`npm run db:init` is a development-only bootstrap command. It creates the configured local database through the PostgreSQL driver, generates Prisma Client, applies committed migrations, and seeds data. `npm run db:reset` destroys and recreates the configured database; do not use it for shared or production data.

A fresh seed creates six active demo users: one admin, one manager, and four team members. The password is `password123` for local development only.

| Role | Name | Email |
|---|---|---|
| ADMIN | Demo Administrator | `admin@example.com` |
| MANAGER | Sarah Fernando | `sarah@example.com` |
| TEAM_MEMBER | Kasun Silva | `kasun@example.com` |
| TEAM_MEMBER | Ayesha Perera | `ayesha@example.com` |
| TEAM_MEMBER | Mohamed Rizwan | `mohamed@example.com` |
| TEAM_MEMBER | Nimal Jayasinghe | `nimal@example.com` |

The seed creates four weekly reports for each team member (16 reports total): four drafts, four submitted, four needing correction, and four approved reports. It includes correction/resubmission examples with complete snapshots and is idempotent. It does not delete extra records from an existing development database.

## Configuration and security

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.local.example` to `frontend/.env.local`. Example files contain every environment key read by application code.

| Location | Required or supported values |
|---|---|
| Backend | `PORT`, `PUBLIC_API_URL`, `FRONTEND_URL`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `AUTH_COOKIE_SAME_SITE`, `ALLOW_SELF_REGISTRATION` |
| Frontend | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_TIMEZONE` |

The API uses Helmet, a restricted credentialed CORS origin (`FRONTEND_URL`), validation with whitelisting and forbidden unknown fields, normalized API errors, and a global API throttle of 100 requests per minute. Auth endpoints have tighter overrides: register 3/minute, login 5/minute, refresh 20/minute.

Passwords use bcrypt with 12 rounds. Access tokens are short-lived and exist only in frontend module memory. Refresh tokens have a unique JWT ID, are SHA-256 hashed before database storage, rotate atomically on use, and are sent only through an HttpOnly cookie scoped to `/api/v1/auth`. Refresh and logout require the `X-Requested-With: weekly-report-web` header. In production, use HTTPS, distinct JWT secrets of at least 32 characters, an explicit `DATABASE_URL`, and appropriate `AUTH_COOKIE_SAME_SITE` settings. Startup rejects insecure production JWT configuration.

The Next.js app removes its powered-by header and sets content-type, frame, referrer, permissions, and production HSTS headers.

## Tests and verification

Latest verified automated counts:

| Suite | Command | Result |
|---|---|---|
| Backend unit | `cd backend; npm test -- --runInBand` | 85 tests, 16 suites |
| Backend HTTP/PostgreSQL E2E | `cd backend; npm run test:e2e` | 24 tests in an isolated temporary PostgreSQL schema |
| Frontend unit/component | `cd frontend; npm test` | 100 tests, 17 files |

The E2E runner requires a locally accessible PostgreSQL server. It creates a random `test_weekly_report_*` schema, applies the committed migration, runs HTTP workflow/RBAC/security/seed checks, and removes only that schema afterward.

Also run:

```bash
cd backend
npm run build
npm run lint
npx prisma validate
npx prisma migrate status

cd ../frontend
npx tsc --noEmit
npm run lint
npm run build
npm run test:coverage
```

## Deployment

No hosting configuration, deployment pipeline, or public URLs are included in this repository. Deploy the frontend and backend as separate services with a managed PostgreSQL database, then:

1. Set the production backend variables and 32+ character distinct JWT secrets.
2. Set `FRONTEND_URL` to the deployed frontend origin and `NEXT_PUBLIC_API_BASE_URL` to the deployed API prefix.
3. Build the backend, run `npx prisma migrate deploy` as the release migration step, and run `npm run start:prod`.
4. Build and deploy the frontend with `npm run build` and its public environment values.
5. Use HTTPS. For separate frontend/API sites, configure `AUTH_COOKIE_SAME_SITE=none`; the secure cookie setting is automatic in production.
6. Smoke-test health, login, a full correction/resubmission workflow, RBAC, and browser behavior at desktop and mobile widths.

## Production readiness

Before release, verify deployment access, production secrets, backups, monitoring, and browser QA for keyboard navigation, mobile layouts, charts, dialogs, cookies, and the complete member-to-manager workflow.
