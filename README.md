# Weekly Report Generator and Team Dashboard

A full-stack internal reporting application. Team members create weekly reports, managers review submitted work, and administrators manage access. The repository contains a Next.js frontend, a NestJS API, Prisma migrations, database setup scripts, demo seeds, and automated tests. PostgreSQL must be installed and running separately.

## Quick start

Prerequisites: Node.js 24+, npm, Git (or a downloaded source ZIP), and a running PostgreSQL 14+ server. Use Node.js 24 for both applications. New to the project? Follow the detailed [setup guide](SETUP.md), including PostgreSQL preparation and troubleshooting.

Clone the repository and enter its root folder:

```bash
git clone https://github.com/sajithmym/weekly-report-generator.git
cd weekly-report-generator
```

If you already have the source, open a terminal in the folder containing this README, `backend/`, and `frontend/`. Install and run each application in its own folder; there is no root-level npm command.

**Terminal 1: configure the backend.** The commands below use Windows PowerShell.

```powershell
cd backend
Copy-Item .env.example .env
```

Open `backend/.env` in your editor and set `DB_USER` and `DB_PASSWORD` to your PostgreSQL login. Check `DB_HOST` and `DB_PORT`; keep `DB_NAME=weekly_report_db` for a dedicated local demo database. The example password `postgres` must match your actual database password. The database user must be able to connect to the `postgres` maintenance database and create the application database if it does not exist.

Then, in the same terminal (inside `backend/`):

```bash
npm ci
npm run db:init
npm run start:dev
```

On macOS/Linux, use `cp .env.example .env` in place of `Copy-Item`. Copy environment files only on first setup; keep your existing configuration on subsequent runs. Leave the backend terminal running.

**Terminal 2: start the frontend.** Open this terminal at the repository root, then run:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm ci
npm run dev
```

On macOS/Linux, use `cp .env.local.example .env.local` in place of `Copy-Item`.

Open [http://localhost:3000](http://localhost:3000) and sign in with `kasun@example.com` / `password123` to try the member workflow. Use `sarah@example.com` / `password123` for the manager dashboard. The [API health endpoint](http://localhost:5000/api/v1/health) should return HTTP 200 with `status: "ok"` and `database: "connected"`.

To stop, press `Ctrl+C` in both terminals. On later runs, start PostgreSQL, run `npm run start:dev` in `backend/`, and run `npm run dev` in `frontend/`. You do not need to initialize the database again for every start.

## Roles

- **TEAM_MEMBER**: creates, edits, submits, and reads only their own reports.
- **MANAGER**: reads team reports, reviews submitted reports, accesses dashboard/roster data, and manages projects. Managers can view users but cannot change user roles or access.
- **ADMIN**: has all manager capabilities plus user creation, role changes, and account activation/deactivation.

The backend is the authorization boundary; frontend redirects are only a usability feature. See the full [role matrix and workflow](docs/PROJECT_REFERENCE.md#roles-and-permissions).

## Demo data

Run `npm run db:init` from `backend/` to apply the committed migration and create the local demo dataset.

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@example.com` | `password123` |
| MANAGER | `sarah@example.com` | `password123` |
| TEAM_MEMBER | `kasun@example.com` | `password123` |
| TEAM_MEMBER | `ayesha@example.com` | `password123` |
| TEAM_MEMBER | `mohamed@example.com` | `password123` |
| TEAM_MEMBER | `nimal@example.com` | `password123` |

These credentials are for local development only. Do not seed production data.

## Verification

After setup, run these optional checks from a new terminal at the repository root. The E2E suite requires local PostgreSQL and permission to create schemas in the configured database. See [tests and quality checks](SETUP.md#tests-and-quality-checks) for details.

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
npm run build
```

Use the test output for current pass/fail results and counts. See the [report creation verification](docs/report-creation-verification.md) for coverage and browser QA guidance.

## Documentation

- [Setup guide](SETUP.md)
- [Documentation index](docs/README.md)
- [Current project reference](docs/PROJECT_REFERENCE.md)
- [Project audit](docs/project-audit.md)
- [Confirmed fixes](docs/project-fixes.md)

The numbered guides and feature subfolders provide detailed, current implementation documentation. Start with the documentation index for feature-by-feature navigation.

## Deployment readiness

This repository does not include a deployment pipeline or public deployment. The required production variables, migration command, release process, and operational checks are documented in [the project reference](docs/PROJECT_REFERENCE.md#deployment).
