# Weekly report domain

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [06-weekly-report-domain.md](../06-weekly-report-domain.md).

## Current implementation

A normalized Monday UTC week identifies a report. Content includes work, planned work, blockers, achievements, hours, notes, and an optional active project. Submission requires at least one named task; it does not require a `DONE` status.

## Verify

Create one member report for a week, verify a duplicate is rejected, and verify a blank-task submission is rejected.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [06-weekly-report-domain.md](../06-weekly-report-domain.md)
