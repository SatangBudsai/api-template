import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { AuthSession } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import { configNumber } from "../../../common/config/config-values";
import { AppError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../database/prisma.service";
import { AuthErrorCodes } from "../auth.error-codes";
import type {
  AuthSessionListItemDto,
  AuthSessionResponseDto,
} from "../dto/auth-response.dto";
import type { LogoutScope } from "../dto/logout.dto";
import { AccessTokenService } from "./access-token.service";
import { AuthorityService } from "./authority.service";
import { AuthKeyService } from "./auth-key.service";

export interface RequestContext {
  ip?: string;
  userAgent?: string;
  traceId: string;
}

export interface SessionIssue extends AuthSessionResponseDto {
  refreshToken: string;
}

type ActiveSession = Prisma.AuthSessionGetPayload<{
  include: { user: { select: { isActive: true } } };
}>;

type RotationResult =
  | { state: "invalid" }
  | { state: "replay" }
  | { state: "ok"; session: AuthSession };

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokenService,
    private readonly authority: AuthorityService,
    private readonly keys: AuthKeyService,
    private readonly config: ConfigService,
  ) {}

  async issue(userId: string, request: RequestContext): Promise<SessionIssue> {
    const now = new Date();
    const refreshToken = opaqueToken();
    const familyExpiresAt = new Date(now.getTime() + this.absoluteTtlMs());
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash: tokenHash(refreshToken),
        familyId: randomUUID(),
        expiresAt: this.refreshExpiresAt(now, familyExpiresAt),
        familyExpiresAt,
        ipHash: request.ip ? this.boundaryHash(request.ip) : null,
        userAgentHash: request.userAgent
          ? this.boundaryHash(request.userAgent)
          : null,
      },
    });
    return this.result(userId, session.id, refreshToken);
  }

  async bootstrap(rawToken: string | undefined): Promise<SessionIssue> {
    const session = await this.activeSession(rawToken);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    return this.result(session.userId, session.id, rawToken as string);
  }

  async refresh(
    rawToken: string | undefined,
    request: RequestContext,
  ): Promise<SessionIssue> {
    if (!rawToken) {
      throw AppError.unauthorized(
        AuthErrorCodes.sessionInvalid,
        "Session is invalid or expired.",
      );
    }

    const replacementToken = opaqueToken();
    const replacementId = randomUUID();
    const now = new Date();

    const rotate = (): Promise<RotationResult> =>
      this.prisma.$transaction(
        async (transaction) => {
          const source = await transaction.authSession.findUnique({
            where: { tokenHash: tokenHash(rawToken) },
            include: { user: { select: { isActive: true } } },
          });

          if (!source) return { state: "invalid" as const };

          if (source.endedAt || source.replacedById) {
            await transaction.authSession.updateMany({
              where: { familyId: source.familyId, endedAt: null },
              data: { endedAt: now, endReason: "REPLAY_DETECTED" },
            });
            return { state: "replay" as const };
          }

          if (!source.user.isActive) {
            await transaction.authSession.updateMany({
              where: { userId: source.userId, endedAt: null },
              data: { endedAt: now, endReason: "USER_DISABLED" },
            });
            return { state: "invalid" as const };
          }

          if (source.expiresAt <= now || source.familyExpiresAt <= now) {
            await transaction.authSession.updateMany({
              where: { familyId: source.familyId, endedAt: null },
              data: { endedAt: now, endReason: "EXPIRED" },
            });
            return { state: "invalid" as const };
          }

          const replacement = await transaction.authSession.create({
            data: {
              id: replacementId,
              userId: source.userId,
              tokenHash: tokenHash(replacementToken),
              familyId: source.familyId,
              expiresAt: this.refreshExpiresAt(now, source.familyExpiresAt),
              familyExpiresAt: source.familyExpiresAt,
              ipHash: request.ip ? this.boundaryHash(request.ip) : null,
              userAgentHash: request.userAgent
                ? this.boundaryHash(request.userAgent)
                : null,
            },
          });

          const claimed = await transaction.authSession.updateMany({
            where: { id: source.id, endedAt: null, replacedById: null },
            data: {
              endedAt: now,
              endReason: "ROTATED",
              replacedById: replacement.id,
              lastUsedAt: now,
            },
          });

          if (claimed.count !== 1) {
            await transaction.authSession.updateMany({
              where: { familyId: source.familyId, endedAt: null },
              data: { endedAt: now, endReason: "REPLAY_DETECTED" },
            });
            return { state: "replay" as const };
          }

          return { state: "ok" as const, session: replacement };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    const rotation = await this.retrySerializable(rotate);

    if (rotation.state === "replay") {
      throw AppError.unauthorized(
        AuthErrorCodes.refreshReplay,
        "Refresh token reuse was detected. Sign in again.",
      );
    }
    if (rotation.state === "invalid") {
      throw AppError.unauthorized(
        AuthErrorCodes.sessionInvalid,
        "Session is invalid or expired.",
      );
    }

    return this.result(
      rotation.session.userId,
      rotation.session.id,
      replacementToken,
    );
  }

  async logout(
    rawToken: string | undefined,
    scope: LogoutScope,
  ): Promise<void> {
    if (!rawToken) return;
    const source = await this.prisma.authSession.findUnique({
      where: { tokenHash: tokenHash(rawToken) },
      select: { userId: true, familyId: true },
    });
    if (!source) return;

    await this.prisma.authSession.updateMany({
      where: {
        endedAt: null,
        ...(scope === "ALL_DEVICES"
          ? { userId: source.userId }
          : { familyId: source.familyId }),
      },
      data: {
        endedAt: new Date(),
        endReason: scope === "ALL_DEVICES" ? "ALL_DEVICES_LOGOUT" : "LOGOUT",
      },
    });
  }

  async list(
    userId: string,
    currentSessionId: string,
  ): Promise<AuthSessionListItemDto[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ lastUsedAt: "desc" }, { issuedAt: "desc" }],
      select: { id: true, issuedAt: true, lastUsedAt: true, expiresAt: true },
    });
    return sessions.map((session) => ({
      id: session.id,
      current: session.id === currentSessionId,
      issuedAt: session.issuedAt.toISOString(),
      lastUsedAt: (session.lastUsedAt ?? session.issuedAt).toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.authSession.findFirst({
      where: { id: sessionId, userId },
      select: { familyId: true },
    });
    if (!session) {
      throw AppError.notFound(
        AuthErrorCodes.sessionNotFound,
        "Session was not found.",
      );
    }
    await this.prisma.authSession.updateMany({
      where: { userId, familyId: session.familyId, endedAt: null },
      data: { endedAt: new Date(), endReason: "LOGOUT" },
    });
  }

  csrfToken(refreshToken: string): string {
    return createHmac("sha256", this.keys.key("csrf"))
      .update(refreshToken)
      .digest("base64url");
  }

  private async activeSession(
    rawToken: string | undefined,
  ): Promise<ActiveSession> {
    if (!rawToken) {
      throw AppError.unauthorized(
        AuthErrorCodes.sessionInvalid,
        "Session is invalid or expired.",
      );
    }
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: tokenHash(rawToken) },
      include: { user: { select: { isActive: true } } },
    });
    const now = new Date();
    if (
      !session ||
      session.endedAt ||
      session.expiresAt <= now ||
      session.familyExpiresAt <= now ||
      !session.user.isActive
    ) {
      throw AppError.unauthorized(
        AuthErrorCodes.sessionInvalid,
        "Session is invalid or expired.",
      );
    }
    return session;
  }

  private async result(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<SessionIssue> {
    const authority = await this.authority.get(userId);
    const access = await this.accessTokens.issue({
      sub: authority.id,
      sid: sessionId,
      ver: authority.accessVersion,
      roles: authority.roles,
      permissions: authority.permissions,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      csrfToken: this.csrfToken(refreshToken),
      refreshToken,
      account: {
        id: authority.id,
        email: authority.email,
        name: authority.name,
        roles: authority.roles,
        permissions: authority.permissions,
      },
    };
  }

  private refreshExpiresAt(now: Date, familyExpiresAt: Date): Date {
    const idleExpiry = new Date(now.getTime() + this.idleTtlMs());
    return idleExpiry < familyExpiresAt ? idleExpiry : familyExpiresAt;
  }

  private async retrySerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034";
        if (!retryable || attempt === 3) throw error;
      }
    }
    throw new Error("Serializable transaction retry exhausted.");
  }

  private idleTtlMs(): number {
    return configNumber(this.config, "AUTH_REFRESH_IDLE_DAYS") * 86_400_000;
  }

  private absoluteTtlMs(): number {
    return configNumber(this.config, "AUTH_REFRESH_ABSOLUTE_DAYS") * 86_400_000;
  }

  private boundaryHash(value: string): string {
    return createHmac("sha256", this.keys.key("session-binding"))
      .update(value)
      .digest("base64url");
  }
}
