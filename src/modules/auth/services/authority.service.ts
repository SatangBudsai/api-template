import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { AuthAccount } from "../../../common/auth/auth-context";
import { AppError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../database/prisma.service";
import { AuthErrorCodes } from "../auth.error-codes";

export type DatabaseClient = Prisma.TransactionClient | PrismaService;

export interface Authority extends AuthAccount {
  accessVersion: number;
}

@Injectable()
export class AuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    database: DatabaseClient = this.prisma,
  ): Promise<Authority> {
    const user = await database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        accessVersion: true,
        roles: {
          where: { status: "ACTIVE", role: { isActive: true } },
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!user?.isActive) {
      throw AppError.unauthorized(
        AuthErrorCodes.accountDisabled,
        "Account is disabled or unavailable.",
      );
    }

    const roles = [...new Set(user.roles.map((item) => item.role.code))].sort();
    const permissions = [
      ...new Set(
        user.roles.flatMap((item) =>
          item.role.permissions.map((value) => value.permission.code),
        ),
      ),
    ].sort();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
      accessVersion: user.accessVersion,
    };
  }
}
