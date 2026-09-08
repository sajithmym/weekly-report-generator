# System architecture

## Components

```text
Next.js 16 browser application
        | JSON API + credentialed refresh cookie
NestJS 11 API at /api/v1
        | Prisma Client
PostgreSQL
```

The frontend (`frontend/`) uses TypeScript, App Router, React Hook Form, Zod, Axios, Tailwind, Radix UI, and Recharts. The backend (`backend/`) is organized into auth, users, projects, reports, dashboard, health, Prisma, settings, and common modules.

## Request lifecycle

1. Axios attaches the short-lived access token to a protected request.
2. NestJS applies Helmet, CORS, DTO validation, throttling, JWT checks, role checks, and ownership/workflow rules.
3. A controller delegates to a service; services apply business rules and Prisma access/transactions.
4. The global exception filter returns a consistent error envelope.
5. The frontend maps typed payloads to components and converts unknown errors safely.

## Configuration and infrastructure

Backend configuration is centralized in `backend/src/settings.ts`; frontend browser-safe values are in `frontend/src/lib/settings.ts`. Only `NEXT_PUBLIC_*` values reach browser code. `backend/scripts/db-init.ts` generates Prisma Client, applies the committed migration, and seeds a local PostgreSQL database.
