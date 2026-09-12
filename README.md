# API Template

Reusable NestJS 11 API foundation for PostgreSQL applications. It includes JWE access tokens, rotating opaque refresh sessions, role-based access control, Prisma migrations, OpenAPI export, and one Problem Details error contract.

## Stack

- NestJS + Fastify
- PostgreSQL + Prisma
- Argon2id password hashing
- Compact JWE access tokens (`dir` + `A256GCM`)
- HttpOnly refresh cookies with rotation and replay-family revocation
- Permission-based RBAC and audit events
- Swagger/OpenAPI and `swagger-typescript-api` compatible output
- Playwright request E2E tests for authentication, refresh rotation, and RBAC

Playwright is the only test runner. API tests use its request fixture without installing a browser and keep all test code in root `tests/`.

## Start locally

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

The database guard refuses migration, seed, and operator commands unless `DATABASE_URL` targets database `api_template` and schema `public`.

OpenAPI JSON: `http://localhost:9000/docs/openapi.json`
Health: `http://localhost:9000/api/health`

## First super administrator

Register a normal account first, then promote that exact account from a trusted operator machine:

```bash
pnpm user:promote -- user@example.com
```

Sign in again or call bootstrap afterward because promotion invalidates existing access tokens.

## Commands

| Command               | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `pnpm start:dev`      | Run with watch mode                                 |
| `pnpm build`          | Build production output                             |
| `pnpm lint`           | Run typed ESLint rules                              |
| `pnpm typecheck`      | Validate TypeScript without emitting                |
| `pnpm test`           | Migrate, seed, build, and run Playwright API E2E    |
| `pnpm db:guard`       | Verify the exact database and schema target         |
| `pnpm db:migrate`     | Guard, then deploy committed migrations             |
| `pnpm db:seed`        | Guard, then upsert permissions and system roles     |
| `pnpm swagger:export` | Build and write `openapi/api-template.swagger.json` |

Before local E2E execution, set `E2E_ALLOW_DATABASE_MUTATION=true`. The suite additionally refuses every target except database `api_template` and schema `public`, creates uniquely named `e2e-*` data, and removes it afterward. CI provides its own PostgreSQL service.

See [authentication and RBAC](docs/authentication-and-rbac.md), [testing](docs/testing.md), [error contract](docs/error-contract.md), and [persistence choice](docs/persistence.md).
