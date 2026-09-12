import type { ConfigService } from "@nestjs/config";

export function configString(config: ConfigService, key: string): string {
  const value = config.get<string>(key)?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

export function configNumber(config: ConfigService, key: string): number {
  return Number(configString(config, key));
}

export function configBoolean(config: ConfigService, key: string): boolean {
  return configString(config, key) === "true";
}

export function allowedOrigins(config: ConfigService): string[] {
  return configString(config, "AUTH_ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
