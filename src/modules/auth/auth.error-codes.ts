import { defineErrorCodes } from "../../common/errors/error-code";

export const AuthErrorCodes = defineErrorCodes({
  registrationDisabled: "AUTH_REGISTER_001",
  emailExists: "AUTH_REGISTER_002",
  invalidCredentials: "AUTH_LOGIN_001",
  accountDisabled: "AUTH_ACCOUNT_001",
  accessTokenMissing: "AUTH_ACCESS_TOKEN_002",
  accessTokenInvalid: "AUTH_ACCESS_TOKEN_001",
  sessionInvalid: "AUTH_SESSION_001",
  refreshReplay: "AUTH_REFRESH_REPLAY_001",
  csrfInvalid: "AUTH_CSRF_001",
  originInvalid: "AUTH_ORIGIN_001",
  permissionDenied: "AUTH_FORBIDDEN_001",
  sessionNotFound: "AUTH_SESSION_REVOKE_001",
});
