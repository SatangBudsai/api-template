import { Module } from "@nestjs/common";

import { RolesController } from "./roles.controller";
import { AuditService } from "./services/audit.service";
import { RoleService } from "./services/role.service";
import { UserRoleService } from "./services/user-role.service";
import { UserRolesController } from "./user-roles.controller";

@Module({
  controllers: [RolesController, UserRolesController],
  providers: [AuditService, RoleService, UserRoleService],
})
export class AccessControlModule {}
