# Manager dashboard

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [10-manager-dashboard.md](../10-manager-dashboard.md).

## Current implementation

Managers/admins use server-filtered roster, summary, status, trend, workload, time, and activity endpoints. Metrics use UTC reporting weeks and exclude private draft content and report IDs; roster/summary may show draft status/count metadata.

## Verify

Use a manager account, change a date filter, and verify dashboard/roster data changes without exposing any member draft.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [10-manager-dashboard.md](../10-manager-dashboard.md)
