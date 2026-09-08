# Deployment

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [17-deployment.md](../17-deployment.md).

## Current implementation

The project documents a release sequence but supplies no hosting pipeline. Production deploys API/frontend separately, runs `prisma migrate deploy`, uses secret storage/HTTPS, then performs operational smoke tests.

## Verify

Confirm secrets, CORS origin, API base URL, cookie behavior, migration status, backups, and role/workflow smoke tests in the target environment.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [17-deployment.md](../17-deployment.md)
