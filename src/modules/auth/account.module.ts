import { Module } from "@nestjs/common";

import { AccountController } from "./account.controller";
import { AccessTokenService } from "./services/access-token.service";
import { AccountService } from "./services/account.service";
import { AuthorityService } from "./services/authority.service";
import { AuthCookieService } from "./services/auth-cookie.service";
import { AuthKeyService } from "./services/auth-key.service";
import { PasswordService } from "./services/password.service";
import { RequestSecurityService } from "./services/request-security.service";
import { SessionService } from "./services/session.service";

@Module({
  controllers: [AccountController],
  providers: [
    AccessTokenService,
    AccountService,
    AuthorityService,
    AuthCookieService,
    AuthKeyService,
    PasswordService,
    RequestSecurityService,
    SessionService,
  ],
  exports: [AccessTokenService, AuthorityService],
})
export class AccountModule {}
