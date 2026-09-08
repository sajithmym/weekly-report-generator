# Testing and quality assurance

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [15-testing.md](../15-testing.md).

## Current implementation

Jest unit tests cover services/guards/workflow, Supertest E2E validates HTTP behavior on an isolated migrated schema, and Vitest/Testing Library cover frontend core modules and components.

## Verify

Run build, lint, Prisma checks, 75 backend unit tests, 14 E2E tests, and 64 frontend tests before sign-off.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [15-testing.md](../15-testing.md)
