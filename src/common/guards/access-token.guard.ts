import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import type { RequestWithAuth } from "../auth/auth-context";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AppError } from "../errors/app-error";
import { PrismaService } from "../../database/prisma.service";
import { AuthErrorCodes } from "../../modules/auth/auth.error-codes";
import { AccessTokenService } from "../../modules/auth/services/access-token.service";
import { AuthorityService } from "../../modules/auth/services/authority.service";

type AuthenticatedRequest = FastifyRequest & RequestWithAuth;

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
    private readonly authority: AuthorityService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    const claims = await this.accessTokens.decrypt(token);

    const [account, session] = await Promise.all([
      this.authority.get(claims.sub),
      this.prisma.authSession.findFirst({
        where: {
          id: claims.sid,
          userId: claims.sub,
          endedAt: null,
          expiresAt: { gt: new Date() },
          familyExpiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
    ]);

    if (!session || account.accessVersion !== claims.ver) {
      throw AppError.unauthorized(
        AuthErrorCodes.accessTokenInvalid,
        "Access token is invalid or expired.",
      );
    }

    request.auth = {
      id: account.id,
      email: account.email,
      name: account.name,
      roles: account.roles,
      permissions: account.permissions,
      sessionId: claims.sid,
      accessVersion: account.accessVersion,
    };
    return true;
  }

  private bearerToken(authorization: string | undefined): string {
    const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];
    if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
      throw AppError.unauthorized(
        AuthErrorCodes.accessTokenMissing,
        "A bearer access token is required.",
      );
    }
    return token;
  }
}
