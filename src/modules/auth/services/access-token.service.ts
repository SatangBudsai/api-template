import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EncryptJWT, jwtDecrypt } from "jose";
import type { JWTPayload } from "jose";

import { configNumber } from "../../../common/config/config-values";
import { AppError } from "../../../common/errors/app-error";
import { AuthErrorCodes } from "../auth.error-codes";
import { AuthKeyService } from "./auth-key.service";

const ALGORITHM = "dir";
const ENCRYPTION = "A256GCM";
const TOKEN_TYPE = "at+jwt";
const KEY_ID = "api-template-access-v1";
const ISSUER = "api-template";
const AUDIENCE = "frontend-template";

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  ver: number;
  roles: string[];
  permissions: string[];
}

export interface IssuedAccessToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AccessTokenService {
  constructor(
    private readonly keys: AuthKeyService,
    private readonly config: ConfigService,
  ) {}

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const ttlSeconds = configNumber(this.config, "AUTH_ACCESS_TTL_SECONDS");
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await new EncryptJWT({
      sid: claims.sid,
      ver: claims.ver,
      roles: claims.roles,
      permissions: claims.permissions,
    })
      .setProtectedHeader({
        alg: ALGORITHM,
        enc: ENCRYPTION,
        typ: TOKEN_TYPE,
        kid: KEY_ID,
      })
      .setSubject(claims.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .encrypt(this.keys.key("jwe"));

    return { token, expiresAt };
  }

  async decrypt(token: string): Promise<AccessTokenClaims> {
    try {
      if (token.split(".").length !== 5) throw new Error("Not a compact JWE.");

      const { payload, protectedHeader } = await jwtDecrypt(
        token,
        this.keys.key("jwe"),
        {
          issuer: ISSUER,
          audience: AUDIENCE,
          keyManagementAlgorithms: [ALGORITHM],
          contentEncryptionAlgorithms: [ENCRYPTION],
        },
      );

      if (
        protectedHeader.alg !== ALGORITHM ||
        protectedHeader.enc !== ENCRYPTION ||
        protectedHeader.typ !== TOKEN_TYPE ||
        protectedHeader.kid !== KEY_ID
      ) {
        throw new Error("Unexpected protected header.");
      }

      return this.parseClaims(payload);
    } catch {
      throw AppError.unauthorized(
        AuthErrorCodes.accessTokenInvalid,
        "Access token is invalid or expired.",
      );
    }
  }

  private parseClaims(payload: JWTPayload): AccessTokenClaims {
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.ver !== "number" ||
      !this.isStringArray(payload.roles) ||
      !this.isStringArray(payload.permissions)
    ) {
      throw new Error("Invalid access-token claims.");
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      ver: payload.ver,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }

  private isStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) && value.every((item) => typeof item === "string")
    );
  }
}
