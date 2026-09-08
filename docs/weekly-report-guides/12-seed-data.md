# Seed data

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [12-seed-data.md](../12-seed-data.md).

## Current implementation

The idempotent local seed creates one admin, one manager, four members, active projects, and 16 reports over four weeks with all workflow states and version/review examples.

## Verify

Run the seed twice in a local disposable database and verify no duplicate user/report for a user/week is created.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [12-seed-data.md](../12-seed-data.md)
