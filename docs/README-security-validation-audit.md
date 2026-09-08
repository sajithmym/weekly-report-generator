# Security and validation audit

## Outcome

The frontend and API now reject malformed input consistently, preserve the documented incomplete-draft workflow, and add browser and logging safeguards without changing the authentication, RBAC, or report-review contracts.

## Problems corrected

- Database-backed route parameters were accepted as arbitrary strings. Invalid identifiers reached Prisma and could yield inconsistent errors. Every user, project, and report route now requires a UUID v4 before service or database work.
- Query filters converted any unrecognised `isActive` value to `false`. Invalid boolean input is now rejected instead of silently changing a filter.
- Several editable strings were not canonicalized at the API boundary, which allowed whitespace-only project names and inconsistent email/text storage. DTOs and browser schemas now trim the relevant values; emails are also lowercased.
- Dashboard/report date filters accepted timestamps despite the date-only reporting model. They now require `YYYY-MM-DD` values.
- Unexpected-error logs contained the entire request URL, including query strings. Logs now use the path only, avoiding accidental query-value disclosure.
- The web app lacked a Content Security Policy. A non-breaking baseline now prevents object embedding, hostile base URLs, framing, and cross-origin form posts.
- The validation rules and E2E contract disagreed on whether a draft may be incomplete. The documented behavior is now applied consistently: creating and editing a draft may omit a project and tasks; submitting still requires both.

## Files changed

- `backend/src/*/dto`: strict boolean/date validation, canonical text handling, and draft-aware report DTOs.
- `backend/src/{users,projects,reports}/*controller.ts`: UUID v4 route parsing at the HTTP boundary.
- `backend/src/reports/reports.service.ts`: removal of create-time submission checks; `ReportWorkflowService.submit` remains the enforcement point.
- `backend/src/common/filters/http-exception.filter.ts`: query-string-safe unexpected-error logging.
- `frontend/src/features/*/schemas` and `weekly-report-form.tsx`: browser validation and UI behavior now match the API draft contract.
- `frontend/next.config.mjs`: baseline CSP header.
- Associated backend/frontend unit and HTTP integration tests were updated or added.

## Verification

Run with Node 24 or later:

```bash
cd backend
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e

cd ../frontend
npx tsc --noEmit
npm run lint
npm test
npm run build
```

This change set was verified with 85 backend unit tests, 24 PostgreSQL HTTP E2E tests, and 100 frontend tests. Backend/frontend builds, type checks, and linting passed. `git diff --check` also passed.

## Trade-offs and deferred items

- The CSP deliberately uses only directives that do not disrupt Next.js runtime scripts. A nonce-based strict script policy is a worthwhile future deployment enhancement, but needs request-level nonce plumbing and browser smoke testing.
- Dependency updates were not made: adding or upgrading packages was outside this audit. Run `npm audit` separately in each package directory during release preparation.
