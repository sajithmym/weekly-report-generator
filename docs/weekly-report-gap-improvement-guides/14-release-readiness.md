# Release readiness

## Implemented behavior

Code/docs describe current implementation: Node 24 runtime, one committed migration, six seed users, 16 seed reports, role separation, rate limiting, refresh rotation, tests, and local setup. Root README and SETUP are entry points.

## Rules and boundaries

Deployment pipeline, public URLs, production secret storage, backups, monitoring, and access controls are external operational concerns. Do not state a release is ready until they are verified.

## Verification

Run all quality commands, complete browser QA, set production secrets/HTTPS, deploy and migrate safely, and verify user access.

## Related guides

- [Authentication and RBAC](../05-authentication-and-rbac.md)
- [Security](../14-security.md)
- [Testing](../15-testing.md)
