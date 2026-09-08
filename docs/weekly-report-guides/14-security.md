# Security design

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [14-security.md](../14-security.md).

## Current implementation

Security combines Helmet, restricted credentialed CORS, production secret validation, bcrypt, memory access tokens, rotating hashed refresh sessions, CSRF-style header checks, RBAC, validation, and global/auth throttling.

## Verify

Use production-like environment settings in a non-production test environment and ensure default/short/equal JWT secrets fail startup validation.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [14-security.md](../14-security.md)
