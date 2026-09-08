# Local Setup Guide

Use this guide for local setup. The numbered and feature-level guides in `docs/` provide detailed current implementation documentation.

## Prerequisites

- Node.js 24 or later (`node --version`)
- npm
- A locally installed or otherwise reachable PostgreSQL 14+ server

The API package requires Node `>=24.0.0`; using Node 24 for both applications avoids version drift.

## 1. Prepare PostgreSQL

Create or use a local PostgreSQL 14+ database and configure `backend/.env` with its host, port, user, password, and database name. The example file defaults to a local `weekly_report_db` database on port `5432`; adjust those values to match your installation.

## 2. Configure and start the backend

```powershell
cd backend
Copy-Item .env.example .env
npm ci
npm run db:init
npm run start:dev
```

On macOS/Linux, replace `Copy-Item` with `cp`.

`db:init` is for local development. It creates the configured database when it is absent, runs Prisma Client generation, applies the committed `20260905000000_initial` migration, and runs the idempotent demo seed. Do not run `db:init` or `db:reset` against production or shared data.

The backend listens on `http://localhost:5000`; verify it with:

```bash
curl http://localhost:5000/api/v1/health
# Returns HTTP 200 when PostgreSQL is connected, or 503 when it is unavailable.
```

## 3. Configure and start the frontend

In a second terminal:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Environment files

### `backend/.env`

The `.env.example` file documents all supported keys. For a typical local PostgreSQL installation, retain or adapt:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=weekly_report_db
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
JWT_ACCESS_SECRET=change-me-to-a-random-access-secret
JWT_REFRESH_SECRET=change-me-to-a-random-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AUTH_COOKIE_SAME_SITE=lax
ALLOW_SELF_REGISTRATION=true
```

The backend expands the `DB_*` placeholders when it loads configuration. If a username, password, or database name has URL-reserved characters, replace `DATABASE_URL` with one fully encoded literal connection string.

For production, set `NODE_ENV=production`, a production `DATABASE_URL`, `FRONTEND_URL`, `PUBLIC_API_URL`, and two distinct random JWT secrets of at least 32 characters. Public self-registration defaults to disabled in production. `AUTH_COOKIE_SAME_SITE=none` is appropriate only when frontend and API are separate HTTPS sites.

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_APP_TIMEZONE=Asia/Colombo
```

`NEXT_PUBLIC_*` values are exposed to browser code. Do not put secrets in this file.

## Demo users

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `password123` |
| MANAGER | `sarah@example.com` | `password123` |
| TEAM_MEMBER | `kasun@example.com` | `password123` |
| TEAM_MEMBER | `ayesha@example.com` | `password123` |
| TEAM_MEMBER | `mohamed@example.com` | `password123` |
| TEAM_MEMBER | `nimal@example.com` | `password123` |

A fresh seed has four reporting weeks per team member, for 16 reports: four each in Draft, Submitted, Needs Correction, and Approved. It includes full version history examples.

## Database commands

Run from `backend/`.

| Command | Purpose |
|---|---|
| `npm run db:init` / `npm run db:fresh` | Development bootstrap: create database, generate client, migrate, seed |
| `npm run db:reset` | Destructively reset the configured database and seed it |
| `npm run seed` | Run the idempotent development seed after migrations exist |
| `npm run prisma:generate` | Generate Prisma Client |
| `npx prisma validate` | Validate Prisma schema |
| `npx prisma migrate status` | Show migration status |
| `npx prisma migrate deploy` | Apply committed migrations; use this release step in production |
| `npm run prisma:studio` | Open Prisma Studio |

## Tests and quality checks

```bash
cd backend
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e
npx prisma validate
npx prisma migrate status

cd ../frontend
npx tsc --noEmit
npm run lint
npm test
npm run test:coverage
npm run build
```

The E2E command requires local PostgreSQL. It creates and cleans an isolated `test_weekly_report_*` schema; it does not reset the development schema.

## Production release sequence

1. Provision PostgreSQL and set the backend production environment values.
2. Install backend dependencies, build, and run `npx prisma migrate deploy` once per release.
3. Start the API with `npm run start:prod` behind HTTPS.
4. Build and deploy the frontend with its public API base URL.
5. Verify health, login, RBAC, and a complete draft-submit-review-correction-resubmit cycle in a real browser.

For the full security model, route list, role matrix, and deployment guidance, read [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md).
