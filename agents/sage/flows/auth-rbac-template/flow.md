# Auth and RBAC implementation flow

## End-to-end sequence

```text
Browser -> POST /api/auth/bootstrap -> refresh cookie lookup
  -> account + roles + permissions -> short-lived compact JWE in memory
  -> protected request with Bearer JWE
  -> AccessTokenGuard checks JWE/session/user/accessVersion
  -> PermissionGuard checks endpoint permissions
  -> 401 triggers one shared refresh promise and one request retry
  -> refresh rotates the opaque cookie token in a serializable transaction
  -> replay of an ended token revokes the active token family
```

## Invariants

- PostgreSQL `api_template/public` is the authentication and authorization source of truth.
- Raw refresh tokens exist only in an HttpOnly cookie; PostgreSQL stores SHA-256 hashes.
- JWE and CSRF values stay in frontend memory and are never persisted in Redux or localStorage.
- Cookie-authenticated mutations validate exact Origin; refresh and logout also validate CSRF.
- System roles are immutable over HTTP, privilege escalation is rejected, and one active super-admin must remain.
- Authority mutations increment `accessVersion`, invalidating older access tokens immediately.
- Stable error `code` and occurrence-specific `traceId` have separate responsibilities.

## Implemented API

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Auth | register, login, bootstrap, refresh, logout, me, session list/revoke |
| Roles | list/create/update/deactivate/replace permissions |
| Assignments | read/replace user roles |
| Catalog | list code-owned permissions |

## Verification completed

- Prisma format, validate, generate, migration deploy, seed, and target guard passed.
- ESLint, TypeScript, Nest build, and OpenAPI export passed before final handoff.
- Live runtime smoke verified health, registration, JWE access, RBAC denial, role creation, duplicate conflict, immutable system roles, refresh rotation, replay detection, family revocation, and cleanup.
- No test framework or checked-in test suite is part of the repository by user request.

## Out of scope

OAuth/OIDC, MFA, password reset/email verification, finished role-management UI, Redis distributed throttling, and an always-on MongoDB connection.
