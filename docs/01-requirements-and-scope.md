# Requirements and scope

## Product goal

Weekly Report Generator is an internal system where team members record weekly work, managers review submitted reports and monitor team reporting, and administrators manage user access. It is not a general project-management, payroll, or public reporting product.

## Roles

| Role | Responsibility | Server-enforced boundary |
|---|---|---|
| TEAM_MEMBER | Create reports and respond to corrections. | Own reports only. |
| MANAGER | Review reports, monitor teams, manage projects. | Cannot create users or change roles/status. |
| ADMIN | Manager capabilities plus access administration. | Still follows report workflow and visibility rules. |

## Included features

- Pending self-registration, login, refresh-token rotation, logout, and current-user lookup.
- Draft, submit, correction, resubmission, approval, immutable versions, and review comments.
- Tasks, next-week tasks, blockers, achievements, work hours, notes, and an optional active project.
- Team dashboard, roster, report review, project maintenance, and administrator user management.
- Prisma migrations, repeatable local seed data, automated backend/frontend tests, and secure deployment guidance.

## Scope boundary

The `user_projects` table exists for future project-membership support, but the current API/UI does not restrict a member to linked projects. Project deletion is a soft archive so historical reports retain their relationships. Browser redirects support usability only; the NestJS API is the authorization boundary.
