import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Permission, Role } from "@prisma/client";

import type { AuthContext } from "../../../common/auth/auth-context";
import { AppError } from "../../../common/errors/app-error";
import { PrismaService } from "../../../database/prisma.service";
import { AccessControlErrorCodes } from "../access-control.error-codes";
import type {
  CreateRoleDto,
  PermissionResponseDto,
  ReplaceRolePermissionsDto,
  RoleResponseDto,
  UpdateRoleDto,
} from "../dto/role.dto";
import { AuditService } from "./audit.service";

const roleInclude = {
  permissions: { select: { permission: { select: { code: true } } } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleInclude;
}>;

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RoleResponseDto[]> {
    const roles = await this.prisma.role.findMany({
      include: roleInclude,
      orderBy: { code: "asc" },
    });
    return roles.map((role) => this.response(role));
  }

  listPermissions(): Promise<PermissionResponseDto[]> {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  async create(
    input: CreateRoleDto,
    actor: AuthContext,
    traceId: string,
  ): Promise<RoleResponseDto> {
    return this.prisma
      .$transaction(async (transaction) => {
        const permissions = await this.resolvePermissions(
          input.permissionCodes,
          actor,
          transaction,
        );
        const role = await transaction.role.create({
          data: {
            code: input.code,
            name: input.name.trim(),
            description: input.description?.trim() || null,
            permissions: {
              create: permissions.map((permission) => ({
                permissionId: permission.id,
              })),
            },
          },
          include: roleInclude,
        });
        await this.audit.create(
          {
            actorId: actor.id,
            action: "role.created",
            resource: "role",
            resourceId: role.id,
            traceId,
            metadata: { code: role.code, permissions: input.permissionCodes },
          },
          transaction,
        );
        return this.response(role);
      })
      .catch((error) => {
        if (this.isUniqueError(error)) {
          throw AppError.conflict(
            AccessControlErrorCodes.roleCodeExists,
            "Role code already exists.",
          );
        }
        throw error;
      });
  }

  async update(
    roleId: string,
    input: UpdateRoleDto,
    actor: AuthContext,
    traceId: string,
  ): Promise<RoleResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.mutableRole(roleId, transaction);
      const role = await transaction.role.update({
        where: { id: existing.id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined
            ? {}
            : { description: input.description.trim() || null }),
        },
        include: roleInclude,
      });
      await this.audit.create(
        {
          actorId: actor.id,
          action: "role.updated",
          resource: "role",
          resourceId: role.id,
          traceId,
        },
        transaction,
      );
      return this.response(role);
    });
  }

  async replacePermissions(
    roleId: string,
    input: ReplaceRolePermissionsDto,
    actor: AuthContext,
    traceId: string,
  ): Promise<RoleResponseDto> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await this.mutableRole(roleId, transaction);
      const permissions = await this.resolvePermissions(
        input.permissionCodes,
        actor,
        transaction,
      );
      await transaction.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length) {
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }
      await this.bumpRoleMembers(roleId, transaction);
      await this.audit.create(
        {
          actorId: actor.id,
          action: "role.permissions-replaced",
          resource: "role",
          resourceId: existing.id,
          traceId,
          metadata: { permissions: input.permissionCodes },
        },
        transaction,
      );
      const role = await transaction.role.findUniqueOrThrow({
        where: { id: roleId },
        include: roleInclude,
      });
      return this.response(role);
    });
  }

  async deactivate(
    roleId: string,
    actor: AuthContext,
    traceId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const role = await this.mutableRole(roleId, transaction);
      await transaction.role.update({
        where: { id: role.id },
        data: { isActive: false },
      });
      await this.bumpRoleMembers(role.id, transaction);
      await this.audit.create(
        {
          actorId: actor.id,
          action: "role.deactivated",
          resource: "role",
          resourceId: role.id,
          traceId,
        },
        transaction,
      );
    });
  }

  private async mutableRole(
    roleId: string,
    database: Prisma.TransactionClient,
  ): Promise<Role> {
    const role = await database.role.findUnique({ where: { id: roleId } });
    if (!role)
      throw AppError.notFound(
        AccessControlErrorCodes.roleNotFound,
        "Role was not found.",
      );
    if (role.isSystem) {
      throw AppError.forbidden(
        AccessControlErrorCodes.systemRoleImmutable,
        "System roles cannot be modified.",
      );
    }
    return role;
  }

  private async resolvePermissions(
    codes: string[],
    actor: AuthContext,
    database: Prisma.TransactionClient,
  ): Promise<Permission[]> {
    const uniqueCodes = [...new Set(codes)];
    const permissions = await database.permission.findMany({
      where: { code: { in: uniqueCodes } },
    });
    if (permissions.length !== uniqueCodes.length) {
      throw AppError.badRequest(
        AccessControlErrorCodes.permissionUnknown,
        "One or more permissions are unknown.",
      );
    }
    if (
      !actor.permissions.includes("system:super-admin") &&
      uniqueCodes.some((code) => !actor.permissions.includes(code))
    ) {
      throw AppError.forbidden(
        AccessControlErrorCodes.privilegeEscalation,
        "You cannot grant a permission that you do not hold.",
      );
    }
    return permissions;
  }

  private async bumpRoleMembers(
    roleId: string,
    database: Prisma.TransactionClient,
  ): Promise<void> {
    const assignments = await database.userRole.findMany({
      where: { roleId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (assignments.length) {
      await database.user.updateMany({
        where: { id: { in: assignments.map((value) => value.userId) } },
        data: { accessVersion: { increment: 1 } },
      });
    }
  }

  private response(role: RoleWithPermissions): RoleResponseDto {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissions: role.permissions
        .map((value) => value.permission.code)
        .sort(),
    };
  }

  private isUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }
}
