import { defineErrorCodes } from "./error-code";

export const CommonErrorCodes = defineErrorCodes({
  validation: "COMMON_VALIDATION_001",
  unauthorized: "COMMON_UNAUTHORIZED_001",
  forbidden: "COMMON_FORBIDDEN_001",
  notFound: "COMMON_NOTFOUND_001",
  conflict: "COMMON_CONFLICT_001",
  rateLimit: "COMMON_RATELIMIT_001",
  database: "COMMON_DATABASE_001",
  internal: "COMMON_INTERNAL_001",
});
