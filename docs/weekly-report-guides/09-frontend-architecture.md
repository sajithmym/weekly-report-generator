# Frontend architecture

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [09-frontend-architecture.md](../09-frontend-architecture.md).

## Current implementation

The App Router separates auth, member, and manager areas. Typed services/API client, schemas, reusable request state, shared components, and feature components avoid duplicated business logic in pages.

## Verify

Run frontend TypeScript, lint, and tests. Confirm a server failure is displayed through the safe error helper and no `any` error cast is required.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [09-frontend-architecture.md](../09-frontend-architecture.md)
