# Error contract

Every HTTP error is returned as `application/problem+json`:

```json
{
  "type": "https://api-template.dev/problems/auth-login-001",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Email or password is incorrect.",
  "instance": "/api/auth/login",
  "code": "AUTH_LOGIN_001",
  "traceId": "req-4"
}
```

Validation errors also include `errors`, keyed by field path.

Feature error codes live in one registry file such as `auth.error-codes.ts`. Keeping codes centralized catches invalid or duplicate values at startup and gives the frontend a stable machine contract. Do not hardcode code strings at individual throw sites.

Business services throw `AppError` factories. The global filter maps these, expected Prisma failures, Nest HTTP errors, and unknown failures to the same shape. A `traceId` identifies one occurrence in logs; it is deliberately separate from the stable `code`.
