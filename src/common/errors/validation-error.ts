import type { ValidationError } from "class-validator";

import type { FieldErrors } from "./app-error";
import { AppError } from "./app-error";
import { CommonErrorCodes } from "./common.error-codes";

export function validationAppError(errors: ValidationError[]): AppError {
  return AppError.badRequest(
    CommonErrorCodes.validation,
    "One or more fields are invalid.",
    flattenValidationErrors(errors),
  );
}

function flattenValidationErrors(errors: ValidationError[]): FieldErrors {
  const result: FieldErrors = {};

  const visit = (error: ValidationError, parent = ""): void => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length) result[path] = messages;
    for (const child of error.children ?? []) visit(child, path);
  };

  for (const error of errors) visit(error);
  return result;
}
