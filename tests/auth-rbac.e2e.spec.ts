import { expect, request, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import pg from "pg";
import { randomUUID } from "node:crypto";

interface Account {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

interface AuthSession {
  accessToken: string;
  csrfToken: string;
  account: Account;
}

interface Role {
  id: string;
  code: string;
  isSystem: boolean;
}

interface ProblemDetails {
  code: string;
  traceId: string;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for E2E tests.");

const origin =
  process.env.AUTH_ALLOWED_ORIGINS?.split(",")[0]?.trim() ??
  "http://localhost:3000";

async function responseJson<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

test("registration, JWE auth, RBAC, refresh rotation, and replay protection work together", async ({
  request: api,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `e2e-${suffix}@example.com`;
  const roleCode = `e2e-role-${suffix}`;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  let userId: string | undefined;
  let roleId: string | undefined;
  let replayContext: APIRequestContext | undefined;

  try {
    const health = await api.get("/api/health");
    expect(health.status()).toBe(200);

    const invalidRegistration = await api.post("/api/auth/register", {
      data: { email: "invalid", name: "", password: "short" },
    });
    expect(invalidRegistration.status()).toBe(400);
    expect((await responseJson<ProblemDetails>(invalidRegistration)).code).toBe(
      "COMMON_VALIDATION_001",
    );

    const registration = await api.post("/api/auth/register", {
      data: {
        email,
        name: "E2E account",
        password: "e2e-secure-password-1234",
      },
    });
    expect(registration.status()).toBe(201);
    const initial = await responseJson<AuthSession>(registration);
    userId = initial.account.id;
    expect(initial.account.email).toBe(email);
    expect(initial.account.roles).toEqual(["user"]);
    expect(initial.accessToken.split(".")).toHaveLength(5);

    const me = await api.get("/api/auth/me", {
      headers: { authorization: `Bearer ${initial.accessToken}` },
    });
    expect(me.status()).toBe(200);
    expect((await responseJson<Account>(me)).id).toBe(userId);

    await pool.query("BEGIN");
    try {
      await pool.query(
        `INSERT INTO user_roles (id, user_id, role_id, status)
         SELECT $2, $1, id, 'ACTIVE'::"UserRoleStatus"
         FROM roles WHERE code = 'super-admin'
         ON CONFLICT (user_id, role_id)
         DO UPDATE SET status = 'ACTIVE', revoked_at = NULL, revoked_by_id = NULL`,
        [userId, randomUUID()],
      );
      await pool.query(
        "UPDATE users SET access_version = access_version + 1 WHERE id = $1",
        [userId],
      );
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }

    const staleAccess = await api.get("/api/roles", {
      headers: { authorization: `Bearer ${initial.accessToken}` },
    });
    expect(staleAccess.status()).toBe(401);
    expect((await responseJson<ProblemDetails>(staleAccess)).code).toBe(
      "AUTH_ACCESS_TOKEN_001",
    );

    const bootstrap = await api.post("/api/auth/bootstrap");
    expect(bootstrap.status()).toBe(200);
    const elevated = await responseJson<AuthSession>(bootstrap);
    expect(elevated.account.roles).toContain("super-admin");

    const rolesResponse = await api.get("/api/roles", {
      headers: { authorization: `Bearer ${elevated.accessToken}` },
    });
    expect(rolesResponse.status()).toBe(200);
    const roles = await responseJson<Role[]>(rolesResponse);
    expect(roles.map((role) => role.code)).toEqual(
      expect.arrayContaining(["admin", "super-admin", "user"]),
    );

    const createRole = await api.post("/api/roles", {
      headers: { authorization: `Bearer ${elevated.accessToken}` },
      data: {
        code: roleCode,
        name: "E2E role",
        permissionCodes: ["account:read"],
      },
    });
    expect(createRole.status()).toBe(201);
    roleId = (await responseJson<Role>(createRole)).id;

    const duplicateRole = await api.post("/api/roles", {
      headers: { authorization: `Bearer ${elevated.accessToken}` },
      data: {
        code: roleCode,
        name: "Duplicate E2E role",
        permissionCodes: ["account:read"],
      },
    });
    expect(duplicateRole.status()).toBe(409);
    expect((await responseJson<ProblemDetails>(duplicateRole)).code).toBe(
      "ACCESS_ROLE_002",
    );

    const systemRole = roles.find((role) => role.code === "user");
    expect(systemRole).toBeDefined();
    const updateSystemRole = await api.patch(`/api/roles/${systemRole?.id}`, {
      headers: { authorization: `Bearer ${elevated.accessToken}` },
      data: { name: "Must not change" },
    });
    expect(updateSystemRole.status()).toBe(403);
    expect((await responseJson<ProblemDetails>(updateSystemRole)).code).toBe(
      "ACCESS_ROLE_003",
    );

    const oldSessionState = await api.storageState();
    const refresh = await api.post("/api/auth/refresh", {
      headers: { "x-csrf-token": elevated.csrfToken },
    });
    expect(refresh.status()).toBe(200);
    const rotated = await responseJson<AuthSession>(refresh);
    expect(rotated.accessToken).not.toBe(elevated.accessToken);

    replayContext = await request.newContext({
      baseURL: "http://127.0.0.1:9000",
      extraHTTPHeaders: { origin },
      storageState: oldSessionState,
    });
    const replay = await replayContext.post("/api/auth/refresh", {
      headers: { "x-csrf-token": elevated.csrfToken },
    });
    expect(replay.status()).toBe(401);
    expect((await responseJson<ProblemDetails>(replay)).code).toBe(
      "AUTH_REFRESH_REPLAY_001",
    );

    const revokedFamily = await api.post("/api/auth/refresh", {
      headers: { "x-csrf-token": rotated.csrfToken },
    });
    expect(revokedFamily.status()).toBe(401);
    expect((await responseJson<ProblemDetails>(revokedFamily)).code).toBe(
      "AUTH_REFRESH_REPLAY_001",
    );
    const activeSessions = await pool.query<{ count: string }>(
      "SELECT count(*) FROM auth_sessions WHERE user_id = $1 AND ended_at IS NULL",
      [userId],
    );
    expect(Number(activeSessions.rows[0]?.count)).toBe(0);
  } finally {
    await replayContext?.dispose();

    if (!userId) {
      const savedUser = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        [email],
      );
      userId = savedUser.rows[0]?.id;
    }
    if (!roleId) {
      const savedRole = await pool.query<{ id: string }>(
        "SELECT id FROM roles WHERE code = $1",
        [roleCode],
      );
      roleId = savedRole.rows[0]?.id;
    }

    if (userId || roleId) {
      if (userId) {
        await pool.query(
          "DELETE FROM audit_events WHERE actor_id::text = $1 OR resource_id = $1",
          [userId],
        );
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      }
      if (roleId) {
        await pool.query("DELETE FROM audit_events WHERE resource_id = $1", [
          roleId,
        ]);
        await pool.query("DELETE FROM roles WHERE id = $1", [roleId]);
      }
    }

    await pool.end();
  }
});
