import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import type { AuthContext } from "../../common/auth/auth-context";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  CreateRoleDto,
  PermissionResponseDto,
  ReplaceRolePermissionsDto,
  RoleResponseDto,
  UpdateRoleDto,
} from "./dto/role.dto";
import { RoleService } from "./services/role.service";

@ApiTags("Access control")
@ApiBearerAuth()
@Controller()
export class RolesController {
  constructor(private readonly roles: RoleService) {}

  @Get("roles")
  @RequirePermissions("roles:read")
  @ApiOkResponse({ type: RoleResponseDto, isArray: true })
  list(): Promise<RoleResponseDto[]> {
    return this.roles.list();
  }

  @Get("permissions")
  @RequirePermissions("permissions:read")
  @ApiOkResponse({ type: PermissionResponseDto, isArray: true })
  listPermissions(): Promise<PermissionResponseDto[]> {
    return this.roles.listPermissions();
  }

  @Post("roles")
  @RequirePermissions("roles:create")
  create(
    @Body() input: CreateRoleDto,
    @CurrentUser() actor: AuthContext,
    @Req() request: FastifyRequest,
  ): Promise<RoleResponseDto> {
    return this.roles.create(input, actor, request.id);
  }

  @Patch("roles/:roleId")
  @RequirePermissions("roles:update")
  update(
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() input: UpdateRoleDto,
    @CurrentUser() actor: AuthContext,
    @Req() request: FastifyRequest,
  ): Promise<RoleResponseDto> {
    return this.roles.update(roleId, input, actor, request.id);
  }

  @Put("roles/:roleId/permissions")
  @RequirePermissions("roles:permissions:update")
  replacePermissions(
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @Body() input: ReplaceRolePermissionsDto,
    @CurrentUser() actor: AuthContext,
    @Req() request: FastifyRequest,
  ): Promise<RoleResponseDto> {
    return this.roles.replacePermissions(roleId, input, actor, request.id);
  }

  @Delete("roles/:roleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("roles:delete")
  @ApiNoContentResponse()
  deactivate(
    @Param("roleId", ParseUUIDPipe) roleId: string,
    @CurrentUser() actor: AuthContext,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    return this.roles.deactivate(roleId, actor, request.id);
  }
}
