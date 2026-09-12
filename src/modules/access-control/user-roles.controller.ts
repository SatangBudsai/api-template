import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import type { AuthContext } from "../../common/auth/auth-context";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ReplaceUserRolesDto, UserRolesResponseDto } from "./dto/user-role.dto";
import { UserRoleService } from "./services/user-role.service";

@ApiTags("Access control")
@ApiBearerAuth()
@Controller("users/:userId/roles")
export class UserRolesController {
  constructor(private readonly userRoles: UserRoleService) {}

  @Get()
  @RequirePermissions("users:roles:read")
  @ApiOkResponse({ type: UserRolesResponseDto })
  get(
    @Param("userId", ParseUUIDPipe) userId: string,
  ): Promise<UserRolesResponseDto> {
    return this.userRoles.get(userId);
  }

  @Put()
  @RequirePermissions("users:roles:update")
  replace(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() input: ReplaceUserRolesDto,
    @CurrentUser() actor: AuthContext,
    @Req() request: FastifyRequest,
  ): Promise<UserRolesResponseDto> {
    return this.userRoles.replace(userId, input, actor, request.id);
  }
}
