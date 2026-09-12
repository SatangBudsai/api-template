import { defineConfig } from "@playwright/test";

function assertSafeDatabaseTarget(): void {
  if (process.env.E2E_ALLOW_DATABASE_MUTATION !== "true") {
    throw new Error(
      "Set E2E_ALLOW_DATABASE_MUTATION=true to run the database-mutating E2E suite.",
    );
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required for E2E tests.");

  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const schema = url.searchParams.get("schema") ?? "public";
  if (database !== "api_template" || schema !== "public") {
    throw new Error(
      "Refusing E2E mutation: expected database api_template and schema public.",
    );
  }
}

assertSafeDatabaseTarget();

const testOrigin =
  process.env.AUTH_ALLOWED_ORIGINS?.split(",")[0]?.trim() ??
  "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:9000",
    extraHTTPHeaders: { origin: testOrigin },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start:prod",
    url: "http://127.0.0.1:9000/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
