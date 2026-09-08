# Project and user management

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [11-project-and-user-management.md](../11-project-and-user-management.md).

## Current implementation

Active projects are readable by authenticated users; manager/admin users create, update, archive, and restore them. Managers can read users; only admins create users or change role/account status.

## Verify

Archive a project instead of deleting it, verify historical report links remain, then prove manager user mutation is forbidden and admin mutation succeeds.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [11-project-and-user-management.md](../11-project-and-user-management.md)
