# Audit Reconciliation

The prior audit described an earlier implementation. Each finding was checked against the current source, committed migration, seed, tests, and configuration before this document was written.

| Historical finding | Current status | Verification |
|---|---|---|
| No committed migration / fresh setup failed | Resolved | `backend/prisma/migrations/20260905000000_initial` and lock file are committed; `db:init`, `migrate deploy`, and isolated E2E use them. |
| No seeded admin | Resolved | Seed creates `admin@example.com`; admin-only user creation, role, and status endpoints remain protected. |
| Private drafts and RBAC gaps | Resolved | Report service rejects access to another author's draft and member endpoints require `TEAM_MEMBER`; manager/admin endpoints use server-side guards. |
| Incomplete workflow/version history | Resolved | Submission stores full snapshots, reviews reference versions, and E2E covers correction and resubmission. |
| Dashboard/roster week calculations | Resolved | Dashboard derives Monday-Sunday UTC rows and tests compliance, pending, late, and roster behavior. |
| Seed counters/integrity | Resolved | The seed now uses the configured four-week count and E2E asserts 16 reports with matching version counters. |
| Missing frontend tests | Resolved | Vitest covers schemas, services, token recovery, hooks, forms, selection, roster, report rendering, auth pages, and shared UI. |
| Global API rate limit configured but not active | Resolved | `ThrottlerGuard` is now an application guard; authentication routes retain stricter limits. |

The current automated verification and external/manual limits are documented in [PROJECT_REFERENCE.md](PROJECT_REFERENCE.md).
