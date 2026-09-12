import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { RequestWithAuth } from "../auth/auth-context";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { AppError } from "../errors/app-error";
import { AuthErrorCodes } from "../../modules/auth/auth.error-codes";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const granted = new Set(request.auth?.permissions ?? []);
    if (!required.every((permission) => granted.has(permission))) {
      throw AppError.forbidden(
        AuthErrorCodes.permissionDenied,
        "You do not have permission to perform this action.",
      );
    }
    return true;
  }
}
