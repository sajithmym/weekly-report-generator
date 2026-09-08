# System architecture

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [02-system-architecture.md](../02-system-architecture.md).

## Current implementation

Next.js provides the browser application, NestJS exposes `/api/v1`, Prisma owns persistence, and PostgreSQL stores relational data. Configuration is centralized in backend settings and frontend browser settings.

## Verify

Start PostgreSQL, API, and frontend. Verify `GET /api/v1/health`, login, and a protected API request flow through the configured API prefix.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [02-system-architecture.md](../02-system-architecture.md)
