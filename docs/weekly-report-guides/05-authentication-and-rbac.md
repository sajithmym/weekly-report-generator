# Authentication and RBAC

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [05-authentication-and-rbac.md](../05-authentication-and-rbac.md).

## Current implementation

Login issues a memory-held access token and HttpOnly rotating refresh cookie. Guards and service ownership checks enforce roles; managers cannot mutate users and drafts remain private from managers/admins.

## Verify

Test each role through the API: member manager-route denial, manager admin-route denial, admin user mutation, and no draft content in team data.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [05-authentication-and-rbac.md](../05-authentication-and-rbac.md)
