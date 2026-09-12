# Testing with Playwright

Playwright is the only test runner. Root `tests/` contains request-level E2E tests; no browser binary is needed for this API repository.

The suite proves health, validation errors, registration, five-part compact JWE access, stale-token invalidation, role permissions, immutable system roles, refresh rotation, replay detection, and family revocation.

## Safety boundary

`pnpm test` migrates and seeds before starting the compiled API. It will mutate data only when both conditions pass:

1. `E2E_ALLOW_DATABASE_MUTATION=true` is explicit.
2. `DATABASE_URL` resolves to database `api_template` and schema `public`.

Every test record uses a unique `e2e-*` identifier and cleanup targets only IDs created by that run. CI runs against an ephemeral PostgreSQL service.

```bash
pnpm test
```
