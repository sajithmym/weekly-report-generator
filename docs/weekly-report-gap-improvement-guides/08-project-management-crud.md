# Project management CRUD

## Implemented behavior

Manager/admin project screens use typed project services to list, create, edit, archive, and reactivate projects. Project pickers retrieve active projects for report creation/editing.

## Rules and boundaries

Project delete is a soft archive. Historical report data continues to reference archived projects. TEAM_MEMBER users can read active projects but cannot mutate them. Current user_projects data is not membership enforcement.

## Verification

Create/edit/archive/restore as manager, confirm a member receives forbidden for mutation, and verify reports retain an archived project reference.

## Related guides

- [Authentication and RBAC](../05-authentication-and-rbac.md)
- [Security](../14-security.md)
- [Testing](../15-testing.md)
