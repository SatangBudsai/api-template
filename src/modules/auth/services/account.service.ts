import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { configBoolean } from "../../../common/config/config-values";
import { AppError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../database/prisma.service";
import { AuthErrorCodes } from "../auth.error-codes";
import type { LoginDto } from "../dto/login.dto";
import type { RegisterDto } from "../dto/register.dto";
import { AuthorityService } from "./authority.service";
import { PasswordService } from "./password.service";
import type { RequestContext, SessionIssue } from "./session.service";
import { SessionService } from "./session.service";

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class AccountService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly authority: AuthorityService,
    private readonly config: ConfigService,
  ) {}

  async register(
    input: RegisterDto,
    request: RequestContext,
  ): Promise<SessionIssue> {
    if (!configBoolean(this.config, "AUTH_REGISTRATION_ENABLED")) {
      throw AppError.forbidden(
        AuthErrorCodes.registrationDisabled,
        "Account registration is disabled.",
      );
    }

    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(input.password);

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const defaultRole = await transaction.role.findUnique({
          where: { code: "user" },
        });
        if (!defaultRole?.isActive)
          throw new Error("Default user role has not been seeded.");

        const created = await transaction.user.create({
          data: { email, name: input.name.trim(), passwordHash },
        });
        await transaction.userRole.create({
          data: { userId: created.id, roleId: defaultRole.id },
        });
        return created;
      });
      return this.sessions.issue(user.id, request);
    } catch (error) {
      if (isUniqueError(error)) {
        throw AppError.conflict(
          AuthErrorCodes.emailExists,
          "An account with this email already exists.",
        );
      }
      throw error;
    }
  }

  async login(input: LoginDto, request: RequestContext): Promise<SessionIssue> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    this.dummyHash ??= this.passwords.hash("not-a-real-user-password");
    const passwordHash = user?.passwordHash ?? (await this.dummyHash);
    const valid = await this.passwords.verify(passwordHash, input.password);

    if (!user || !valid) {
      throw AppError.unauthorized(
        AuthErrorCodes.invalidCredentials,
        "Email or password is incorrect.",
      );
    }
    if (!user.isActive) {
      throw AppError.unauthorized(
        AuthErrorCodes.accountDisabled,
        "Account is disabled or unavailable.",
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.sessions.issue(user.id, request);
  }

  getMe(userId: string): ReturnType<AuthorityService["get"]> {
    return this.authority.get(userId);
  }
}
