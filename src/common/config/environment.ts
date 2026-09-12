const DEFAULTS = {
  API_PREFIX: "api",
  PORT: "9000",
  AUTH_ACCESS_TTL_SECONDS: "600",
  AUTH_REFRESH_IDLE_DAYS: "7",
  AUTH_REFRESH_ABSOLUTE_DAYS: "30",
} as const;

export interface AppEnvironment {
  DATABASE_URL: string;
  NODE_ENV: string;
  PORT: string;
  API_PREFIX: string;
  AUTH_ALLOWED_ORIGINS: string;
  AUTH_REGISTRATION_ENABLED: string;
  AUTH_ACCESS_TTL_SECONDS: string;
  AUTH_REFRESH_IDLE_DAYS: string;
  AUTH_REFRESH_ABSOLUTE_DAYS: string;
  AUTH_COOKIE_SECURE: string;
  AUTH_SECRET_BASE64: string;
}

function required(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function optional(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  return value.trim();
}

function positiveInteger(value: string, key: string): string {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return value;
}

function booleanString(value: string, key: string): string {
  if (value !== "true" && value !== "false") {
    throw new Error(`${key} must be true or false.`);
  }
  return value;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): AppEnvironment {
  const secret = Buffer.from(required(config, "AUTH_SECRET_BASE64"), "base64");
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET_BASE64 must decode to at least 32 bytes.");
  }

  const databaseUrl = required(config, "DATABASE_URL");
  const database = decodeURIComponent(
    new URL(databaseUrl).pathname.replace(/^\//, ""),
  );
  const schema = new URL(databaseUrl).searchParams.get("schema") ?? "public";
  if (database !== "api_template" || schema !== "public") {
    throw new Error(
      "DATABASE_URL must target the api_template/public database schema.",
    );
  }

  const idleDays = positiveInteger(
    optional(config, "AUTH_REFRESH_IDLE_DAYS", DEFAULTS.AUTH_REFRESH_IDLE_DAYS),
    "AUTH_REFRESH_IDLE_DAYS",
  );
  const absoluteDays = positiveInteger(
    optional(
      config,
      "AUTH_REFRESH_ABSOLUTE_DAYS",
      DEFAULTS.AUTH_REFRESH_ABSOLUTE_DAYS,
    ),
    "AUTH_REFRESH_ABSOLUTE_DAYS",
  );
  if (Number(idleDays) > Number(absoluteDays)) {
    throw new Error(
      "AUTH_REFRESH_IDLE_DAYS cannot exceed AUTH_REFRESH_ABSOLUTE_DAYS.",
    );
  }

  return {
    DATABASE_URL: databaseUrl,
    NODE_ENV: optional(config, "NODE_ENV", "development"),
    PORT: positiveInteger(optional(config, "PORT", DEFAULTS.PORT), "PORT"),
    API_PREFIX: optional(config, "API_PREFIX", DEFAULTS.API_PREFIX).replace(
      /^\/+|\/+$/g,
      "",
    ),
    AUTH_ALLOWED_ORIGINS: required(config, "AUTH_ALLOWED_ORIGINS"),
    AUTH_REGISTRATION_ENABLED: booleanString(
      optional(config, "AUTH_REGISTRATION_ENABLED", "false"),
      "AUTH_REGISTRATION_ENABLED",
    ),
    AUTH_ACCESS_TTL_SECONDS: positiveInteger(
      optional(
        config,
        "AUTH_ACCESS_TTL_SECONDS",
        DEFAULTS.AUTH_ACCESS_TTL_SECONDS,
      ),
      "AUTH_ACCESS_TTL_SECONDS",
    ),
    AUTH_REFRESH_IDLE_DAYS: idleDays,
    AUTH_REFRESH_ABSOLUTE_DAYS: absoluteDays,
    AUTH_COOKIE_SECURE: booleanString(
      optional(config, "AUTH_COOKIE_SECURE", "true"),
      "AUTH_COOKIE_SECURE",
    ),
    AUTH_SECRET_BASE64: required(config, "AUTH_SECRET_BASE64"),
  };
}
