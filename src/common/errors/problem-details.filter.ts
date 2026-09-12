import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ExceptionFilter } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";

import { AppError } from "./app-error";
import { CommonErrorCodes } from "./common.error-codes";

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  traceId: string;
  errors?: Record<string, string[]>;
}

function isPrismaError(
  error: unknown,
): error is { code: string; meta?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("P")
  );
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    if (reply.sent) return;

    const traceId = request.id || randomUUID();
    const problem = this.toProblem(exception, request.url, traceId);

    if (problem.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled request error traceId=${traceId} method=${request.method} url=${request.url}`,
        stack,
      );
    } else {
      this.logger.warn(
        `${problem.detail} traceId=${traceId} method=${request.method} url=${request.url} code=${problem.code}`,
      );
    }

    void reply
      .header("x-trace-id", traceId)
      .status(problem.status)
      .type("application/problem+json")
      .send(problem);
  }

  private toProblem(
    exception: unknown,
    instance: string,
    traceId: string,
  ): ProblemDetails {
    if (exception instanceof AppError) {
      return this.problem({
        instance,
        traceId,
        status: exception.status,
        title: exception.title,
        detail: exception.message,
        code: exception.code,
        errors: exception.errors,
      });
    }

    if (isPrismaError(exception)) {
      if (exception.code === "P2002") {
        return this.problem({
          instance,
          traceId,
          status: HttpStatus.CONFLICT,
          title: "Conflict",
          detail: "A record with the same unique value already exists.",
          code: CommonErrorCodes.conflict,
        });
      }
      if (exception.code === "P2025") {
        return this.problem({
          instance,
          traceId,
          status: HttpStatus.NOT_FOUND,
          title: "Not Found",
          detail: "The requested resource was not found.",
          code: CommonErrorCodes.notFound,
        });
      }
      return this.problem({
        instance,
        traceId,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        title: "Internal Server Error",
        detail: "A database operation could not be completed.",
        code: CommonErrorCodes.database,
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === "string"
          ? response
          : this.httpExceptionDetail(response, exception.message);
      return this.problem({
        instance,
        traceId,
        status,
        title: this.statusTitle(status),
        detail,
        code: this.httpErrorCode(status),
      });
    }

    return this.problem({
      instance,
      traceId,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: "Internal Server Error",
      detail: "An unexpected error occurred.",
      code: CommonErrorCodes.internal,
    });
  }

  private problem(input: Omit<ProblemDetails, "type">): ProblemDetails {
    return {
      type: `https://api-template.dev/problems/${input.code.toLowerCase().replaceAll("_", "-")}`,
      ...input,
      ...(input.errors && Object.keys(input.errors).length > 0
        ? { errors: input.errors }
        : {}),
    };
  }

  private httpExceptionDetail(response: object, fallback: string): string {
    if ("message" in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message))
        return message.filter((value) => typeof value === "string").join(", ");
    }
    return fallback;
  }

  private statusTitle(status: number): string {
    const title = HttpStatus[status];
    return typeof title === "string"
      ? title.replaceAll("_", " ")
      : "Request Error";
  }

  private httpErrorCode(status: HttpStatus): string {
    if (status === HttpStatus.BAD_REQUEST) return CommonErrorCodes.validation;
    if (status === HttpStatus.UNAUTHORIZED)
      return CommonErrorCodes.unauthorized;
    if (status === HttpStatus.FORBIDDEN) return CommonErrorCodes.forbidden;
    if (status === HttpStatus.NOT_FOUND) return CommonErrorCodes.notFound;
    if (status === HttpStatus.CONFLICT) return CommonErrorCodes.conflict;
    if (status === HttpStatus.TOO_MANY_REQUESTS)
      return CommonErrorCodes.rateLimit;
    return CommonErrorCodes.internal;
  }
}
