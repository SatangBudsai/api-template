# Authentication and RBAC

## Browser flow

1. `POST /api/auth/login` or `/register` sets an opaque refresh token in an HttpOnly cookie and returns a short-lived JWE, CSRF token, and account snapshot.
2. The frontend stores the JWE and CSRF value in memory only. Redux may store lifecycle status and the account snapshot, but never either token.
3. After reload, `POST /api/auth/bootstrap` uses the cookie to restore memory state without rotating it. This avoids tabs invalidating one another during startup.
4. Protected calls send `Authorization: Bearer <JWE>`.
5. One 401 recovery is allowed. The frontend performs one shared refresh promise, rotates the refresh token, updates the in-memory JWE, and retries the original request once.
6. Reuse of an already rotated refresh token revokes the remaining active token family and requires login again.
7. Logout revokes the current family or all account sessions and clears browser memory.

The API remains the authorization authority. Client-side role checks are only a UX optimization.

## Token boundaries

| Value                     | Storage                   | Lifetime                                   |
| ------------------------- | ------------------------- | ------------------------------------------ |
| Password                  | Request only              | Discarded after Argon2id verification/hash |
| JWE access token          | Browser memory            | 10 minutes by default                      |
| Raw refresh token         | HttpOnly, SameSite cookie | 7-day idle / 30-day absolute by default    |
| Refresh token hash        | PostgreSQL                | Retained to detect replay                  |
| CSRF value                | Browser memory            | Changes with refresh rotation              |
| Account/roles/permissions | Redux memory              | Rebuilt during bootstrap                   |

Cookie-authenticated mutations require an allowed `Origin`. Refresh and logout additionally require `x-csrf-token`.

## RBAC

Permissions are code-owned and seeded from `config/access-control.json`. APIs create custom roles by grouping known permissions and assign roles to users as a replace-set transaction.

- System roles are immutable through HTTP.
- Non-super-admin actors cannot grant permissions they do not hold.
- Privileged system roles require `system:super-admin`.
- The final active super-admin assignment cannot be removed.
- Authority changes increment `users.access_version`; older JWE values immediately fail validation.
- Mutations write allowlisted audit metadata without credentials or tokens.

## Frontend usage

`frontend-template` proxies same-origin `/api/*` to the server-only `SERVICE_URL`. Its generated client and provider handle bootstrap and single-flight refresh.

```tsx
"use client";

import { useAuth } from "@/providers/auth-provider";

export function AccountMenu() {
  const { status, account, login, logout } = useAuth();

  if (status === "loading") return <span>Loading…</span>;
  if (status !== "authenticated") {
    return (
      <button
        onClick={() =>
          void login({ email: "user@example.com", password: "passphrase" })
        }
      >
        Sign in
      </button>
    );
  }

  return (
    <button onClick={() => void logout()}>{account?.name}: sign out</button>
  );
}
```

Use TanStack Query for normal server data. The generated singleton automatically adds the memory JWE and performs one refresh/retry on 401:

```tsx
const query = useQuery({
  queryKey: ["roles"],
  queryFn: () => apiTemplate.api.rolesControllerList(),
});
```
