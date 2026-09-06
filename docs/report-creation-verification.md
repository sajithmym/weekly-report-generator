# Report creation and workflow verification

Verified locally on 6 September 2026.

## Fixes

- Matched frontend date validation to the API: actual calendar dates, date-only values, and Monday–Sunday weeks, including year and leap-year boundaries.
- Validated project UUIDs and single key-issue/key-achievement selections before saving. Empty drafts still allow no project and no tasks.
- Compute the default reporting week when a form opens, rather than when its module first loads.
- Guard duplicate form submissions, disable inputs while saving, and preserve entered content on failure.
- Renumber next-week tasks after edits/removals and order them in version snapshots.
- Replace the misleading "Tasks completed" heading with "Tasks and progress". The documented workflow intentionally allows TODO and BLOCKED tasks and zero recorded time; submission requires a project and at least one named task.
- Clear obsolete report state after a successful submission or review. A failed follow-up read now shows a retry state instead of obsolete edit/submit/review actions. Ordinary manual refresh still preserves loaded content.
- Store SUBMITTED as the state in newly created submission snapshots. Existing historical snapshots are unchanged.
- Translate concurrent weekly uniqueness violations into the same readable duplicate-report message used by the preflight check, for both creation and edits.

## Automated coverage

Final results: 78 backend unit tests, 23 PostgreSQL HTTP E2E tests, and 89 frontend unit/component tests passed (190 total). Backend/frontend lint and production builds also passed. The running API health check reported PostgreSQL connected; the frontend login and new-report routes returned HTTP 200.

The PostgreSQL HTTP suite creates real member accounts through registration/activation and administrator invitation, logs in with real credentials, and exercises the first-report workflow. Only privileged test fixtures are inserted directly. Tests use the standard guards, validation, cookies and response filters.

Coverage includes empty initial dashboards/history, incomplete private drafts, every report section, partial updates and clearing collections, invalid values and field limits, cross-member access, inactive/missing projects, concurrent creation/submission/approval, read-only states, correction and resubmission, immutable version content, project rename history, version-linked reviews, roster status/first-submission timing, and immediate access denial for deactivated accounts.

Frontend tests cover form and page behavior: project selection, draft creation/navigation, failed-save retry with retained inputs, repeated submits, week rollover, content serialization, input validation, refresh protection, and failed reloads after submission/approval. Floating-popover positioning and the calendar surface are mocked in page integration tests because JSDOM has no browser layout engine; these tests do not establish browser rendering correctness.

Run from the indicated directory:

```powershell
# backend
npm test -- --runInBand
npm run test:e2e
npm run lint
npm run build

# frontend
npm test
npm run lint
npm run build
```

The E2E runner creates a uniquely named schema in local PostgreSQL, applies migrations, and removes that schema on completion. Run E2E tests through `npm run test:e2e`, which provides this isolation.

## Smoke test against the running localhost API

An additional test ran against `http://localhost:5000/api/v1`, independently of the isolated test suite:

1. Administrator created a new TEAM_MEMBER account; the account logged in and initially had zero reports.
2. Created a first draft containing a project, DONE/TODO tasks, next-week tasks, blockers, achievements, work hours and notes.
3. Confirmed duplicate-week rejection and draft privacy from the administrator.
4. Submitted version 1 and confirmed that direct edits were rejected.
5. Requested corrections, saved changes, resubmitted version 2, and approved it.
6. Compared the original immutable snapshot, verified both linked reviews, and confirmed approved reports remain read-only.
7. Deactivated the QA member, verified its existing access token was rejected, and archived the QA project.

Retained inspection fixture:

- Account: `qa-first-report-20260906063158641@example.invalid` (inactive).
- User ID: `2480f062-860f-418b-957a-6e3306da7a1f`.
- Project ID: `b67568ed-e51d-41bc-973b-eabca1e6987d` (archived).
- Report: `087a93ce-6e1d-441d-b588-49d6a1e80a84`, APPROVED, version 2.
- [Open the QA report with a manager/admin session](http://localhost:3000/manager/reports/087a93ce-6e1d-441d-b588-49d6a1e80a84).

No passwords or access tokens are recorded here. The retained QA account/project do not contribute to active-member tracking or active project selection. The approved report remains in report history and may appear in report-based historical analytics.

## Verification limit

No browser connection was available in the agent session. The live workflow was exercised through HTTP; visual layout, real-browser clicks, calendar/popover behavior, and mobile presentation were not independently verified. Passing automated tests is evidence for the covered cases, not a guarantee that every possible defect is absent.
