# Database design

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [04-database-design.md](../04-database-design.md).

## Current implementation

Prisma models accounts, projects, report content, immutable versions/reviews, and refresh tokens. The committed initial migration is the only schema baseline and reports are unique per member/week.

## Verify

Run `npx prisma validate` and `npx prisma migrate status`; inspect data with Prisma Studio only against a safe local database.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [04-database-design.md](../04-database-design.md)
