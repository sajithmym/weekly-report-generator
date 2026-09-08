# Security architecture and control catalogue

This document describes the protections implemented in the Weekly Report Generator as they exist in the codebase. It is a control catalogue: each item identifies the enforcement point, the threat it reduces, and its operating boundary. It does **not** claim the application is invulnerable; deployment configuration, dependency maintenance, backups, monitoring, and operational access controls remain essential.

## Security model

The application has a Next.js browser client, a NestJS API, and PostgreSQL accessed only through Prisma. The browser is not trusted for authorization or workflow decisions. The API validates each request, derives the authenticated user from a verified token, enforces roles and ownership, and writes through Prisma's parameterized query layer.

| Layer | Trust decision | Primary enforcement |
| --- | --- | --- |
| Browser | Improves user experience; never grants authority | Client schemas, route redirects, secure response headers |
| API boundary | Rejects malformed and unexpected input | Nest `ValidationPipe`, DTO decorators, UUID pipes |
| Authentication | Establishes the current user | Signed JWT verification and active-user database lookup |
| Authorization | Decides who may perform an operation | `RolesGuard`, report ownership and draft-visibility checks |
| Workflow | Decides which state transitions are legal | Transactional report workflow service |
| Database | Preserves relationship and uniqueness guarantees | PostgreSQL foreign keys, unique constraints, Prisma transactions |

## 1. Configuration and secret safety

**Controls**

- Runtime configuration is centralized in [`backend/src/settings.ts`](../backend/src/settings.ts).
- Production startup rejects missing, reused, insecure, or fewer-than-32-character access and refresh JWT secrets.
- Production startup requires `DATABASE_URL`.
- Refresh-cookie settings are checked so `SameSite=None` cannot be used without `Secure`.
- Database URL components are URL-encoded when the connection string is constructed from individual environment variables.
- Development fallback secrets are intentionally rejected in production.

**Protection provided**

This prevents a deployment from silently using known development secrets, the same secret for two token classes, malformed database credentials, or an unsafe cross-site cookie configuration.

**Operational requirements**

- Set distinct, randomly generated `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in the deployment secret store. Never commit them.
- Use a least-privilege PostgreSQL account and require TLS for remote database connections.
- Keep `.env` files outside source control and rotate secrets if they are exposed.

## 2. Transport, browser, and origin protections

### API headers and CORS

[`backend/src/main.ts`](../backend/src/main.ts) installs Helmet, cookie parsing, and credentialed CORS. CORS permits only the configured `FRONTEND_URL`, the explicit HTTP methods, and the required authorization/CSRF headers.

- **Threat reduced:** arbitrary browser origins using a logged-in user's cookies to call the API.
- **Boundary:** CORS is a browser control, not an authorization mechanism. API authorization still runs on every request.

### Frontend security headers

[`frontend/next.config.mjs`](../frontend/next.config.mjs) adds these headers to application pages:

| Header/control | Protection |
| --- | --- |
| `Content-Security-Policy` | Disallows plugin/object content, hostile `<base>` URLs, framing, and cross-origin form submissions. |
| `X-Content-Type-Options: nosniff` | Reduces MIME-type interpretation attacks. |
| `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` | Prevents clickjacking through framing. |
| `Referrer-Policy: strict-origin-when-cross-origin` | Limits URL/referrer leakage to other origins. |
| `Permissions-Policy` | Disables camera, microphone, and geolocation access. |
| Production HSTS | Instructs browsers to use HTTPS after a secure first visit. |
| `poweredByHeader: false` | Avoids disclosing the framework through `X-Powered-By`. |

**Operational requirement:** serve both frontend and API over HTTPS in production. HSTS cannot protect an initial insecure visit, and TLS termination must be correctly configured at the reverse proxy/load balancer.

## 3. Authentication and session protection

### Passwords

Passwords are hashed with bcrypt using the configured work factor before persistence. Password hashes are not selected in normal user responses.

- **Threat reduced:** disclosure of reversible passwords from the database or API responses.
- **Boundary:** use a strong password policy and consider breach-password screening or MFA for higher-risk deployments.

### Access tokens

The API issues short-lived signed access JWTs. The frontend stores an access token only in module memory, not in `localStorage` or `sessionStorage`, and sends it in the `Authorization: Bearer` header.

- **Threat reduced:** persistence of bearer tokens in browser storage where later script injection could recover them.
- **Boundary:** an access token remains a bearer credential until it expires; HTTPS and XSS defenses remain important.

### Refresh tokens and rotation

The refresh-token path is implemented by [`backend/src/auth/auth.service.ts`](../backend/src/auth/auth.service.ts) and [`backend/src/auth/auth.controller.ts`](../backend/src/auth/auth.controller.ts).

- Refresh tokens are stored in an `HttpOnly` cookie scoped to `/api/v1/auth`; browser JavaScript cannot read it.
- Cookies use `Secure` in production (and whenever cross-site cookie mode is selected), a configured `SameSite` policy, and a bounded lifetime.
- The database stores only a SHA-256 hash of each refresh token, never the raw token.
- A refresh verifies both token signature and the stored hash, expiry, and token owner.
- Refresh rotation atomically compares/deletes the old token and creates a new one inside a database transaction. A concurrent replay can consume a token once only.
- Logout deletes the matching hashed token. Refreshing a deactivated user deletes all of that user's refresh tokens.
- The frontend shares one in-flight refresh request, preventing multiple simultaneous 401 responses from racing to rotate the same refresh token.

### CSRF protection for cookie operations

Refresh and logout require the configured `X-Requested-With` header in addition to the refresh cookie. The frontend sends this header with API calls.

- **Threat reduced:** a third-party site cannot normally supply both the scoped cookie and the required custom header in a cross-origin browser request.
- **Boundary:** do not relax CORS to arbitrary origins. If the frontend is hosted on a different origin, use HTTPS and configure `AUTH_COOKIE_SAME_SITE=none` deliberately.

### Account state and session invalidation

[`JwtStrategy`](../backend/src/auth/strategies/jwt.strategy.ts) re-checks the user in PostgreSQL for every protected request and rejects deleted or inactive users. This means an administrator's deactivation takes effect even if the user's access token has not expired.

## 4. Authorization and data isolation

### Role-based access control

All protected modules use `JwtAuthGuard` and `RolesGuard`. Endpoint roles are declared with `@Roles(...)`; for example:

- Team members create, edit, submit, and view their own reports.
- Managers and administrators access team reports, dashboard data, reviews, project administration, and user management as declared by their controllers.
- Role changes and account activation/deactivation are administrator-only.

The authoritative role is loaded from the database during JWT validation, rather than trusting a stale role claim in the token.

### Ownership and report visibility

[`ReportsService.findById`](../backend/src/reports/reports.service.ts) checks ownership in the service layer, not only in the UI.

- A team member cannot read or edit another member's report.
- Draft content is private to its author, including from manager/admin report-detail endpoints.
- Dashboard roster data deliberately exposes draft state metadata only, not draft contents or draft report IDs.
- Update and submit operations require the report owner.

### Identifier validation

Database-backed `:id` routes use Nest's UUID v4 parsing before service/database work. Query DTOs validate UUID filters as well.

- **Threat reduced:** malformed IDs reaching persistence code, inconsistent errors, and accidental broad queries.
- **Boundary:** UUID validation confirms format only; authorization and existence checks still follow.

## 5. Input validation and canonicalization

### Global request boundary

The global Nest validation pipe uses:

- `whitelist: true` to strip properties not declared by a DTO;
- `forbidNonWhitelisted: true` to reject attempts to send unexpected properties;
- `transform: true` to safely transform validated scalar query values.

DTOs add type, enum, range, string length, nested-object, maximum-array-size, UUID, and strict date-only validation. Text values such as names, emails, task text, and review comments are trimmed at the boundary or service layer; emails are normalized to lowercase.

### Reporting-period integrity

Report-date validation is enforced in the API service layer, even for callers that bypass HTTP DTO validation.

- A reporting week must start on Monday and end on the following Sunday.
- Values must be date-only `YYYY-MM-DD` values; timestamps and impossible dates are rejected.
- Future reporting weeks are rejected.
- Each user may have only one report per reporting week; the database also enforces `@@unique([userId, weekStart])`.
- Manager filters validate order and construct only supplied date bounds.

The frontend duplicates helpful parts of this validation for immediate feedback, but the API is the authority.

### Domain-state integrity

- At most one blocker may be marked as the key issue and at most one achievement as the key achievement.
- Drafts may be incomplete, but submission requires a selected active project and at least one non-blank task.
- Archived projects cannot be assigned to new reports or submitted from an existing draft.
- Task/work-hour numeric limits and section size limits prevent oversized or invalid payloads.
- Duplicate user email errors are translated to a conflict response rather than an internal server error.

## 6. Workflow and concurrency protections

Report editing, submission, change requests, and approvals use Prisma transactions. The report row is locked before state checks, and state transitions use compare-and-update conditions.

| Operation | Guarded transition | Protection |
| --- | --- | --- |
| Edit | `DRAFT`/`NEEDS_CORRECTION` only | Submitted/approved reports cannot be overwritten. |
| Submit | editable → `SUBMITTED` | Ownership, submission completeness, active project, and version number are checked atomically. |
| Request changes | `SUBMITTED` → `NEEDS_CORRECTION` | Requires a non-blank correction comment and the current submitted version. |
| Approve | `SUBMITTED` → `APPROVED` | Requires the current submitted version. |
| Version creation | one immutable snapshot per submitted version | Preserves the submitted state for audit/review history. |

The database unique constraint and service-level check together prevent concurrent duplicate weekly reports. Review snapshots preserve the content that was actually submitted rather than mutable later draft data.

## 7. Database and error-handling protections

### Database access

Prisma is used for application queries rather than interpolated SQL. This parameterizes normal data access and reduces SQL injection risk. PostgreSQL constraints enforce foreign-key relationships, report-week uniqueness, unique emails, and cascading deletion of child report content where defined.

Raw SQL is limited to the internal report-row locking helper and uses parameterized Prisma execution.

### Safe failures and logs

[`GlobalExceptionFilter`](../backend/src/common/filters/http-exception.filter.ts) returns one consistent error envelope.

- Expected validation, authorization, not-found, conflict, and Prisma constraint failures are translated into appropriate HTTP responses.
- Production mode replaces unexpected exception details with a generic internal-error message.
- Unexpected-error logs use only the request path, not the full URL/query string, reducing accidental leakage of query values.
- The frontend displays safe API messages through a single error-message helper and clears session state/redirects on an unrecoverable refresh failure.

## 8. Abuse resistance

The global throttle allows 100 requests per minute per configured throttler identity. Authentication endpoints apply tighter limits:

| Endpoint | Limit per minute |
| --- | ---: |
| Registration | 3 |
| Login | 5 |
| Refresh | 20 |

These controls reduce credential stuffing, registration floods, and refresh-token abuse. They are not a replacement for network-layer rate limiting, WAF rules, alerting, or account lockout policies in a public deployment.

## 9. Frontend safety controls

- Client route/role checks make the UI less likely to expose inappropriate navigation, while API authorization remains authoritative.
- The API client retries a protected request once after a successful token refresh; it does not loop indefinitely.
- When refresh fails, the in-memory access token is cleared and the browser returns to login.
- Toast and form behavior is covered by tests so validation/error feedback does not leave stale UI state.
- The weekly report date picker disables non-Monday and future start dates; the API independently validates the same rule.

## 10. Verification coverage

Security-related behavior is covered by unit, component, and PostgreSQL HTTP integration tests. Important cases include:

- invalid credentials, inactive accounts, token expiry, refresh rotation/replay, logout, and refresh-token uniqueness;
- CSRF header checks for refresh/logout;
- role guards, ownership checks, private drafts, manager/admin access rules, and self-role/self-status changes;
- UUID, boolean, date-only, nested DTO, unknown-field, size/range, and workflow validation;
- duplicate reports during concurrent creation and serialized submissions;
- inactive projects, exact deadline handling, duplicate users, report history, and audit snapshots;
- browser schema/date-picker/toast behavior and API refresh retry handling.

Run the full verification suite with a supported Node.js version:

```bash
cd backend
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e

cd ../frontend
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## 11. Deployment checklist

Before production release:

1. Configure HTTPS for frontend, API, and remote database connections.
2. Set distinct random JWT secrets (32+ characters) through a secret manager.
3. Set `DATABASE_URL`, `FRONTEND_URL`, `PUBLIC_API_URL`, and cookie settings for the real deployment origins.
4. Set `NODE_ENV=production`; confirm startup rejects unsafe secrets.
5. Disable self-registration unless it is a deliberate product feature.
6. Use a least-privilege database role; restrict database network access.
7. Run dependency audits and apply security updates in both `backend` and `frontend`.
8. Centralize logs, redact sensitive metadata, monitor failed logins/refreshes, and define incident response procedures.
9. Back up PostgreSQL, test restoration, and document data-retention requirements.
10. Review this document whenever authentication, roles, endpoints, CSP, cookies, or database access changes.

## 12. Known boundaries and future hardening

- The CSP is a compatibility-focused baseline. A nonce-based strict CSP can further reduce XSS exposure, but requires request-level nonce support and browser smoke testing.
- Rate limiting is application-level. Deploy network-level rate limits and monitoring for internet-facing environments.
- The application does not currently implement MFA, password-breach screening, user lockout, audit-log retention policy, encryption-at-rest management, or formal vulnerability scanning. Add controls appropriate to the organisation's risk profile.
- Security depends on secure hosting, dependency updates, secret rotation, and administrator practices; source-code controls alone are insufficient.
