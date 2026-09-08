# Performance and scalability

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [16-performance-and-scalability.md](../16-performance-and-scalability.md).

## Current implementation

The application uses paginated server lists and database aggregation. Query/index/caching changes require measurement and must preserve visibility/workflow filters. Multi-instance rate limiting needs shared storage.

## Verify

Test pagination/filter validation and inspect dashboard query plans with realistic data before adding a database index or cache.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [16-performance-and-scalability.md](../16-performance-and-scalability.md)
