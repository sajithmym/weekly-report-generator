# Project setup

## Prerequisites

Use Node.js 24+, npm, and a reachable PostgreSQL 14+ server. The backend enforces Node `>=24.0.0`; use Node 24 for both apps.

## Local startup

```powershell
cd backend
Copy-Item .env.example .env
npm ci
npm run db:init
npm run start:dev
```

The API is `http://localhost:5000/api/v1`. In a second terminal:

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. On macOS/Linux use `cp` rather than `Copy-Item`.

## First use

Use seeded local accounts such as `admin@example.com`, `sarah@example.com`, or a team member with password `password123`. These credentials are development-only. `db:init` must only target a developer-owned local database. Full environment and verification instructions are in [SETUP.md](../SETUP.md).
