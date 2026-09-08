# Local Setup Guide

Follow these steps in order to run the application locally. You will run PostgreSQL, the backend API, and the frontend together. The commands use Windows PowerShell unless marked otherwise; macOS/Linux copy commands are provided as well.

## Prerequisites

- Node.js 24 or later (`node --version`)
- npm
- Git if cloning the repository (a downloaded and extracted source ZIP also works)
- A running PostgreSQL 14+ server and its host, port, username, and password

The API package requires Node `>=24.0.0`; using Node 24 for both applications avoids version drift.

Check the installed tools in a terminal:

```bash
node --version
npm --version
git --version
```

Git is optional if you use a ZIP. Dependency installation needs internet access. Reopen your terminal after installing tools so it picks up PATH changes.

## 1. Get the source

```bash
git clone https://github.com/sajithmym/weekly-report-generator.git
cd weekly-report-generator
```

If the source is already on your computer, open a terminal in its root folder instead. This is the folder containing `README.md`, `SETUP.md`, `backend/`, and `frontend/`. Run npm commands inside the appropriate application folder; there is no root-level `package.json`.

## 2. Prepare PostgreSQL

Install PostgreSQL if needed, remember the password you set for its `postgres` user, and start the database service. On Windows, you can check the PostgreSQL service in the Services app and connect using pgAdmin. On macOS/Linux, start the service using your installation's service manager.

The example configuration uses host `localhost`, port `5432`, user `postgres`, and database `weekly_report_db`. The password in the example is only a placeholder; use your actual PostgreSQL password in the next step. The application does not install or start PostgreSQL for you.

You do not need to create the application database manually: `db:init` creates it if absent. The configured user must be able to connect to the `postgres` maintenance database and have `CREATEDB` permission, or the application database must already exist and allow that user to create tables and apply migrations. The bootstrap still connects to the maintenance database when the application database already exists.

Use a dedicated local development database. The bootstrap is designed for local PostgreSQL; a hosted server with SSL requirements or restricted maintenance-database access may require a different provisioning process.

## 3. Configure and start the backend

In terminal 1, starting at the repository root:

```powershell
cd backend
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead. If `backend/.env` already exists, edit it instead of copying over it.

**Before running database initialization**, open `backend/.env` in your editor and update:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_actual_postgresql_password
DB_NAME=weekly_report_db
```

Replace `your_actual_postgresql_password` with your database password. Keep the other example values for a standard local setup, including `NODE_ENV=development` and `AUTH_COOKIE_SAME_SITE=lax`. For passwords containing special characters, see [environment files](#environment-files) before continuing.

Save the file, then run in the same terminal (inside `backend/`):

```bash
npm ci
npm run db:init
npm run start:dev
```

Wait for each command to succeed before continuing. `db:init` creates the configured database when absent, generates Prisma Client, applies committed migrations, and adds demo users and reports. It preserves existing seeded accounts and reports for the same weeks; it does not restore changed passwords. Do not run `db:init` or `db:reset` against production or shared data.

Leave this terminal running. The backend listens on `http://localhost:5000`. Open [the health endpoint](http://localhost:5000/api/v1/health) in a browser, or check it from another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
```

On macOS/Linux:

```bash
curl -i http://localhost:5000/api/v1/health
```

Expected: HTTP 200 with `status: "ok"` and `database: "connected"`. HTTP 503 means PostgreSQL is unavailable. The bare API address (`http://localhost:5000/`) is not the frontend and may return 404.

## 4. Configure and start the frontend

Open terminal 2 at the repository root (the parent of `backend/`), then run:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm ci
npm run dev
```

On macOS/Linux, use `cp .env.local.example .env.local` instead of `Copy-Item`. Skip the copy if you already have a configured `.env.local`.

The example points to `http://localhost:5000/api/v1`. If you changed the API port, update `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` and restart the frontend.

Leave both terminals running and open [http://localhost:3000](http://localhost:3000). Keep `localhost` consistent across the browser URL and both environment files so browser sessions and CORS work correctly.

## 5. Sign in and check the application

1. Sign in with `kasun@example.com` and `password123`. Confirm the member's seeded reports load, then open a Draft report to try editing and submitting it.
2. Sign out and sign in with `sarah@example.com` and `password123`. Confirm the manager dashboard and submitted reports load.
3. Use `admin@example.com` and `password123` to manage users and access.

Use the seeded accounts for your first login. Newly self-registered accounts require an administrator to activate them before they can sign in.

## Stop and restart

Press `Ctrl+C` in each application terminal to stop it. To start again, ensure PostgreSQL is running, then use two terminals opened at the repository root:

Terminal 1:

```bash
cd backend
npm run start:dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Keep your environment files and database between sessions. Repeat `npm ci` when dependencies change. After pulling changes that include Prisma schema or migration updates, run `npm run prisma:generate` and `npx prisma migrate deploy` from `backend/` before starting the API. Restart the relevant application after editing its environment file.

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

The backend expands the `DB_*` placeholders when it loads configuration. Keep `DB_*` values unencoded and quote values containing `#` or spaces. If credentials contain URL-reserved characters, replace `DATABASE_URL` with a literal connection string whose username and password are percent-encoded, so direct Prisma CLI commands and the backend connect consistently. For example, the password `my@password` becomes `my%40password` in the URL:

```env
DB_PASSWORD="my@password"
DATABASE_URL="postgresql://postgres:my%40password@localhost:5432/weekly_report_db"
```

Encode the credential components, not the entire URL. Use a simple database name such as `weekly_report_db`; the bootstrap accepts letters, numbers, and underscores and requires the first character to be a letter or underscore. Environment files are ignored by Git; keep your actual credentials out of committed files.

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

These checks are optional for running the app. Complete dependency installation and database setup first, then open a new terminal at the repository root. Stop the frontend dev server before running the production build check.

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

The E2E command requires the configured PostgreSQL database to exist on `localhost`, `127.0.0.1`, or `::1`, and the database user must have permission to create schemas. It creates and cleans an isolated `test_weekly_report_*` schema; it does not reset the development schema. Neither application dev server needs to be running for these automated checks.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `node` or `npm` is not recognized, or npm reports `EBADENGINE` | Install/use Node.js 24+, reopen the terminal, and check `node --version` and `npm --version`. |
| PowerShell says `npm.ps1` cannot be loaded | Use `npm.cmd` in place of `npm` and `npx.cmd` in place of `npx`, or run the commands in Command Prompt (use `copy` instead of `Copy-Item`). |
| npm cannot find `package.json` | Run the command from `backend/` or `frontend/`, as indicated, rather than the repository root. |
| Database connection refused, Prisma `P1001`, or health returns 503 | Start PostgreSQL and check `DB_HOST`, `DB_PORT`, and `DATABASE_URL` in `backend/.env`. |
| Password authentication failed or Prisma `P1000` | Set the actual PostgreSQL username/password in `backend/.env`; check quoting and URL encoding for special characters. |
| Permission denied creating a database or connecting to `postgres` | Use a local database role with maintenance-database access and `CREATEDB`, or have the database owner create the application database and grant the required access. |
| Tables are missing or Prisma Client is not initialized | After correcting the database settings, run `npm run db:init` from `backend/` and wait for it to finish successfully. |
| `EADDRINUSE` or Next.js starts on port 3001 | Stop the process using the intended port, or update the configuration consistently. An API port change requires backend `PORT`/`PUBLIC_API_URL` and frontend `NEXT_PUBLIC_API_BASE_URL`; a frontend port change requires backend `FRONTEND_URL` and the matching `npm run dev -- --port 3001` command. Restart both apps. |
| Login shows a network/CORS error, or the session does not persist | Check API health, the `/api/v1` suffix in `NEXT_PUBLIC_API_BASE_URL`, and that `FRONTEND_URL` exactly matches the browser origin. Use `localhost` consistently and `AUTH_COOKIE_SAME_SITE=lax` for local HTTP. |
| Demo login fails or a new account is inactive | Check that seeding succeeded and use an account from the demo table. Seeding does not reset an existing account's password or activation status; self-registered accounts need administrator activation. |
| Login returns HTTP 429 after repeated attempts | Wait for the one-minute rate-limit window before trying again. |
| Migration history or schema mismatch | Use a new dedicated local database name and run `db:init`, or investigate with `npx prisma migrate status`. `db:reset` deletes the configured database's data; use it only for disposable local data. |

## Production release sequence

1. Provision PostgreSQL and set the backend production environment values.
2. From `backend/`, run `npm ci --include=dev`, `npm run prisma:generate`, `npm run build`, and `npx prisma migrate deploy` once per release. Build tooling requires development dependencies during this step.
3. Start the API with `npm run start:prod` behind HTTPS.
4. Set the frontend's public API base URL before building. From `frontend/`, run `npm ci --include=dev`, `npm run build`, and `npm run start` for a Node-hosted deployment.
5. Verify health, login, RBAC, and a complete draft-submit-review-correction-resubmit cycle in a real browser.

For the full security model, route list, role matrix, and deployment guidance, read [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md).
