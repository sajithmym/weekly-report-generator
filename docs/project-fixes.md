# Confirmed Fixes and Verification

This record contains only changes verified against the current repository.

- Added and committed the Prisma baseline migration and an isolated-schema E2E runner.
- Added the seeded admin account and kept account, role, and status mutation ADMIN-only.
- Enforced report ownership, private drafts, workflow state transitions, full version snapshots, and review-to-version links.
- Added roster/compliance calculations, dashboard filters, project soft deletion, refresh-token rotation/replay protection, validation limits, and current role checks.
- Corrected the seed loop to honor the configured four reporting weeks, producing 16 reports on a fresh seed.
- Activated the configured global API throttle while retaining strict authentication limits.
- Added frontend Vitest/Testing Library coverage and removed production `any` request payload and error handling paths.
- Fixed weekly-form controlled select defaults and exposed shared load errors through an accessible alert role.

Current commands and verified test counts are in [PROJECT_REFERENCE.md](PROJECT_REFERENCE.md). The remaining work is production deployment preparation and browser/device QA.
