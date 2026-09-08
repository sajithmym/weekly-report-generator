# Database design

## Migration ownership

`backend/prisma/schema.prisma` defines the model. The committed baseline migration is `20260905000000_initial` and PostgreSQL is locked by `migration_lock.toml`. Use `npx prisma migrate deploy` for committed releases; never use `migrate dev` in production.

## Entities

| Group | Tables | Purpose |
|---|---|---|
| Identity | `users`, `refresh_tokens` | Accounts and secure browser sessions. |
| Projects | `projects`, `user_projects` | Active/archived projects and future membership relation. |
| Current report | `reports`, `report_tasks`, `next_week_tasks`, `blockers`, `achievements`, `work_hours` | Current editable report data. |
| Workflow audit | `report_versions`, `reviews` | Submission snapshots and decisions/comments. |

## Constraints and relationships

`reports` is unique by `(userId, weekStart)`. A `weekStart` is Monday UTC. A project archive retains past report links. Refresh-token JWT IDs are unique and only SHA-256 hashes are stored. Versions are immutable snapshots and reviews reference the version acted upon.

```text
User 1--* Report 1--* Tasks / NextWeekTasks / Blockers / Achievements / WorkHours
User 1--* RefreshToken
Project 1--* Report
Report 1--* ReportVersion 1--* Review
User *--* Project through UserProject (reserved for a future membership policy)
```

See [21 Database setup](21-database-setup-guide.md) for safe local and production commands.
