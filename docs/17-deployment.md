# Deployment guide

## Current repository boundary

The repository has no CI/CD pipeline, hosting configuration, public URL, secret store, or monitoring provider. Supply those with the chosen deployment platform.

## Release sequence

1. Provision PostgreSQL, backups, restricted network/database access, HTTPS, and production secret storage.
2. Set backend `NODE_ENV=production`, `DATABASE_URL`, `FRONTEND_URL`, `PUBLIC_API_URL`, and distinct 32+ character JWT secrets. Set `AUTH_COOKIE_SAME_SITE` for the deployed origins.
3. Install/build the backend and run `npx prisma migrate deploy` once as the controlled migration step.
4. Start the API with `npm run start:prod` behind an HTTPS-aware proxy/load balancer.
5. Build/deploy frontend with `NEXT_PUBLIC_API_BASE_URL` pointed to the final `/api/v1` endpoint.
6. Smoke-test health, login/refresh/logout, role boundaries, report correction/resubmission, manager dashboard, CORS, and cookies.

Do not run `db:init`, `db:reset`, `migrate reset`, or development seed in shared/production data. Back up before migrations, monitor errors/auth/database health, and keep a rollback plan compatible with the migrated schema.
