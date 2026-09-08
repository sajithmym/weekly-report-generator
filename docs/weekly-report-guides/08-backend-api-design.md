# Backend API design

## Purpose

This implementation guide describes the current feature, the code boundary that owns it, and the expected behavior. It is a focused companion to [08-backend-api-design.md](../08-backend-api-design.md).

## Current implementation

Controllers accept validated DTOs and services own business rules. Responses and errors use a shared envelope. Routes are grouped under health, auth, reports, manager, projects, and users.

## Verify

Check an invalid DTO, unauthorized request, missing record, and paginated list; each should return the expected HTTP status and normalized envelope.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [08-backend-api-design.md](../08-backend-api-design.md)
