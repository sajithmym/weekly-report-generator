# Validation, errors, and logging

## Purpose

This implementation guide describes the current feature, its code boundary, and the expected behavior. It is a focused companion to [13-validation-error-handling-and-logging.md](../13-validation-error-handling-and-logging.md).

## Current implementation

NestJS DTO validation whitelists input and rejects unknown/malformed values. The exception filter provides one error contract. React forms validate early and display safe narrowed error messages.

## Verify

Send an unknown property, invalid UUID, invalid date filter, and malformed report collection; verify the API rejects each without leaking internals.

## Related documentation

- [Project reference](../PROJECT_REFERENCE.md)
- [13-validation-error-handling-and-logging.md](../13-validation-error-handling-and-logging.md)
