# Testing and quality assurance

## Automated suites

| Area | Command | Current result |
|---|---|---|
| Backend unit | `cd backend; npm test -- --runInBand` | 75 tests, 14 suites |
| Backend E2E | `cd backend; npm run test:e2e` | 14 HTTP/PostgreSQL tests |
| Frontend unit/component | `cd frontend; npm test` | 64 tests, 14 files |
| Frontend coverage | `cd frontend; npm run test:coverage` | Passing; 38.72% overall statement coverage |

Backend unit coverage includes auth/token behavior, guards, response/error handling, reports/workflow validation, projects, users, dashboard calculations, and health behavior. The E2E runner creates a random `test_weekly_report_*` PostgreSQL schema, applies the committed migration, tests RBAC/security/workflow/seed behavior, then removes only that schema.

Frontend tests cover auth forms/redirects, schemas, report form dynamics, roster/report presentation, API services, Axios behavior, resource state, date utilities, entity selection, pagination, badges, and safe errors.

## Required checks

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

## Browser QA

Before release test member draft/save/submit, manager correction/approve, resubmission, admin role/status updates, session refresh, keyboard dialogs/forms, mobile/desktop layouts, charts, cookies, and forbidden URLs in a real browser. No Playwright/Cypress suite is included.
