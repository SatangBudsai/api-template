import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

import { allowedOrigins } from "../../../common/config/config-values";
import { AppError } from "../../../common/errors/app-error";
import { AuthErrorCodes } from "../auth.error-codes";

@Injectable()
export class RequestSecurityService {
  private readonly origins: Set<string>;

  constructor(config: ConfigService) {
    this.origins = new Set(allowedOrigins(config));
  }

  verifyOrigin(origin: string | undefined): void {
    const normalized = origin?.replace(/\/$/, "");
    if (!normalized || !this.origins.has(normalized)) {
      throw AppError.forbidden(
        AuthErrorCodes.originInvalid,
        "Request origin is not allowed.",
      );
    }
  }

  verifyCsrf(expected: string, actual: string | undefined): void {
    if (!actual)
      throw AppError.forbidden(
        AuthErrorCodes.csrfInvalid,
        "CSRF token is invalid.",
      );
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw AppError.forbidden(
        AuthErrorCodes.csrfInvalid,
        "CSRF token is invalid.",
      );
    }
  }
}
