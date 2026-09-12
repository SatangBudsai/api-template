import { defineErrorCodes } from "../../common/errors/error-code";

export const AccessControlErrorCodes = defineErrorCodes({
  roleNotFound: "ACCESS_ROLE_001",
  roleCodeExists: "ACCESS_ROLE_002",
  systemRoleImmutable: "ACCESS_ROLE_003",
  permissionUnknown: "ACCESS_PERMISSION_001",
  privilegeEscalation: "ACCESS_PERMISSION_002",
  userNotFound: "ACCESS_USER_ROLE_001",
  lastSuperAdmin: "ACCESS_USER_ROLE_002",
});
