# Database setup and migration guide

## Local database

Create or select a local PostgreSQL 14+ database, configure its connection values in `backend/.env`, then run:

```powershell
cd backend
npm ci
npm run db:init
```

`db:init` creates a missing local database, generates Prisma Client, applies migration `20260905000000_initial`, and runs the idempotent development seed. It must only target a developer-owned local database.

## Commands

| Command | Purpose |
|---|---|
| `npx prisma validate` | Validate schema. |
| `npx prisma migrate status` | Compare configured database with migrations. |
| `npx prisma migrate deploy` | Apply committed migrations in releases. |
| `npm run seed` | Rerun local seed. |
| `npm run prisma:studio` | Inspect local data. |
| `npm run db:reset` | Destructively reset and seed local configured DB. |

## Production

Use a restricted database user, full production `DATABASE_URL`, backups, staging validation, and controlled `migrate deploy` execution. Never run init/reset/local demo seed against shared production data. E2E does not reset development data: it creates/migrates/removes a random temporary schema.
