# Weekly Report Generator and Team Dashboard

A full-stack internal reporting application. Team members create weekly reports, managers review submitted work, and administrators manage access. The repository contains a Next.js frontend, a NestJS API, Prisma migrations, PostgreSQL development infrastructure, seeds, and automated tests.

## Quick start

Prerequisites: Node.js 24+, npm, and PostgreSQL 16 or compatible PostgreSQL 14+. The included Docker Compose file starts PostgreSQL 16.

```powershell
docker compose up -d

cd backend
Copy-Item .env.example .env
npm ci
npm run db:init
npm run start:dev
```

On macOS/Linux, use `cp .env.example .env` in place of `Copy-Item`.

In a second terminal:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm ci
npm run dev
```

On macOS/Linux, use `cp .env.local.example .env.local` in place of `Copy-Item`.

Open `http://localhost:3000`. The API health endpoint is `http://localhost:5000/api/v1/health`.

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

The latest verified suites contain 78 backend unit tests, 23 backend HTTP/PostgreSQL E2E tests, and 89 frontend unit/component tests. See the [report creation verification](docs/report-creation-verification.md) for fixes, coverage, the localhost smoke test, and remaining browser QA.

## Documentation

- [Setup guide](SETUP.md)
- [Current project reference](docs/PROJECT_REFERENCE.md)
- [Audit reconciliation](docs/assignment-audit.md)
- [Confirmed fixes](docs/assignment-fixes.md)

The numbered guides and feature subfolders provide detailed, current implementation documentation. Start with the documentation index for feature-by-feature navigation.

## Deployment and submission artifacts

This repository does not contain a deployment pipeline, public deployment, Dockerfile, presentation, ER diagram image, or demo video. The required production variables, migration command, release process, and remaining manual submission work are documented in [the project reference](docs/PROJECT_REFERENCE.md#deployment).
