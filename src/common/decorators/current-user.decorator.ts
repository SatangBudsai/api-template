import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";

import type { AuthContext, RequestWithAuth } from "../auth/auth-context";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.auth)
      throw new Error("CurrentUser used without a validated auth context.");
    return request.auth;
  },
);
