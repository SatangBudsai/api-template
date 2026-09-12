import { HttpStatus } from "@nestjs/common";

import type { ErrorCode } from "./error-code";

export type FieldErrors = Record<string, string[]>;

export interface AppErrorOptions {
  status: number;
  code: ErrorCode;
  title: string;
  detail: string;
  errors?: FieldErrors;
  cause?: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly title: string;
  readonly errors?: FieldErrors;

  constructor(options: AppErrorOptions) {
    super(options.detail, { cause: options.cause });
    this.name = "AppError";
    this.status = options.status;
    this.code = options.code;
    this.title = options.title;
    this.errors = options.errors;
  }

  static badRequest(
    code: ErrorCode,
    detail: string,
    errors?: FieldErrors,
  ): AppError {
    return new AppError({
      status: HttpStatus.BAD_REQUEST,
      code,
      title: "Bad Request",
      detail,
      errors,
    });
  }

  static unauthorized(code: ErrorCode, detail: string): AppError {
    return new AppError({
      status: HttpStatus.UNAUTHORIZED,
      code,
      title: "Unauthorized",
      detail,
    });
  }

  static forbidden(code: ErrorCode, detail: string): AppError {
    return new AppError({
      status: HttpStatus.FORBIDDEN,
      code,
      title: "Forbidden",
      detail,
    });
  }

  static notFound(code: ErrorCode, detail: string): AppError {
    return new AppError({
      status: HttpStatus.NOT_FOUND,
      code,
      title: "Not Found",
      detail,
    });
  }

  static conflict(code: ErrorCode, detail: string): AppError {
    return new AppError({
      status: HttpStatus.CONFLICT,
      code,
      title: "Conflict",
      detail,
    });
  }

  static unprocessable(code: ErrorCode, detail: string): AppError {
    return new AppError({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code,
      title: "Unprocessable Entity",
      detail,
    });
  }
}
