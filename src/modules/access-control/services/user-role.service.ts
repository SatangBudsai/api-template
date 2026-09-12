import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { AuthContext } from "../../../common/auth/auth-context";
import { AppError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../database/prisma.service";
import { AccessControlErrorCodes } from "../access-control.error-codes";
import type {
  ReplaceUserRolesDto,
  UserRolesResponseDto,
} from "../dto/user-role.dto";
import { AuditService } from "./audit.service";

@Injectable()
export class UserRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(userId: string): Promise<UserRolesResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: {
          where: { status: "ACTIVE", role: { isActive: true } },
          select: { role: { select: { code: true } } },
        },
      },
    });
    if (!user)
      throw AppError.notFound(
        AccessControlErrorCodes.userNotFound,
        "User was not found.",
      );
    return {
      userId: user.id,
      roles: user.roles.map((value) => value.role.code).sort(),
    };
  }

  async replace(
    userId: string,
    input: ReplaceUserRolesDto,
    actor: AuthContext,
    traceId: string,
  ): Promise<UserRolesResponseDto> {
    return this.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!user)
          throw AppError.notFound(
            AccessControlErrorCodes.userNotFound,
            "User was not found.",
          );

        const requestedCodes = [...new Set(input.roleCodes)];
        const roles = await transaction.role.findMany({
          where: { code: { in: requestedCodes }, isActive: true },
          include: {
            permissions: { select: { permission: { select: { code: true } } } },
          },
        });
        if (roles.length !== requestedCodes.length) {
          throw AppError.badRequest(
            AccessControlErrorCodes.roleNotFound,
            "One or more roles are unknown or inactive.",
          );
        }
        this.ensureNoPrivilegeEscalation(roles, actor);
        await this.ensureSuperAdminRemains(userId, requestedCodes, transaction);

        const active = await transaction.userRole.findMany({
          where: { userId, status: "ACTIVE" },
          select: { roleId: true },
        });
        const requestedIds = new Set(roles.map((role) => role.id));
        const revokedIds = active
          .filter((value) => !requestedIds.has(value.roleId))
          .map((value) => value.roleId);

        if (revokedIds.length) {
          await transaction.userRole.updateMany({
            where: { userId, roleId: { in: revokedIds }, status: "ACTIVE" },
            data: {
              status: "REVOKED",
              revokedAt: new Date(),
              revokedById: actor.id,
            },
          });
        }
        for (const role of roles) {
          await transaction.userRole.upsert({
            where: { userId_roleId: { userId, roleId: role.id } },
            create: { userId, roleId: role.id, assignedById: actor.id },
            update: {
              status: "ACTIVE",
              assignedAt: new Date(),
              assignedById: actor.id,
              revokedAt: null,
              revokedById: null,
            },
          });
        }
        await transaction.user.update({
          where: { id: userId },
          data: { accessVersion: { increment: 1 } },
        });
        await this.audit.create(
          {
            actorId: actor.id,
            action: "user.roles-replaced",
            resource: "user",
            resourceId: userId,
            traceId,
            metadata: { roles: requestedCodes },
          },
          transaction,
        );
        return { userId, roles: requestedCodes.sort() };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private ensureNoPrivilegeEscalation(
    roles: Array<{
      code: string;
      isSystem: boolean;
      permissions: Array<{ permission: { code: string } }>;
    }>,
    actor: AuthContext,
  ): void {
    if (actor.permissions.includes("system:super-admin")) return;
    const attemptsPrivilegedRole = roles.some(
      (role) => role.isSystem && role.code !== "user",
    );
    const attemptsUnknownPermission = roles.some((role) =>
      role.permissions.some(
        (value) => !actor.permissions.includes(value.permission.code),
      ),
    );
    if (attemptsPrivilegedRole || attemptsUnknownPermission) {
      throw AppError.forbidden(
        AccessControlErrorCodes.privilegeEscalation,
        "You cannot assign authority that you do not hold.",
      );
    }
  }

  private async ensureSuperAdminRemains(
    userId: string,
    requestedCodes: string[],
    database: Prisma.TransactionClient,
  ): Promise<void> {
    const currentlySuperAdmin = await database.userRole.findFirst({
      where: { userId, status: "ACTIVE", role: { code: "super-admin" } },
      select: { id: true },
    });
    if (!currentlySuperAdmin || requestedCodes.includes("super-admin")) return;

    const count = await database.userRole.count({
      where: {
        status: "ACTIVE",
        role: { code: "super-admin", isActive: true },
        user: { isActive: true },
      },
    });
    if (count <= 1) {
      throw AppError.conflict(
        AccessControlErrorCodes.lastSuperAdmin,
        "The final active super administrator cannot be removed.",
      );
    }
  }
}
