import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthContext } from "../../common/auth/auth-context";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import {
  AuthAccountDto,
  AuthSessionListItemDto,
  AuthSessionResponseDto,
} from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RegisterDto } from "./dto/register.dto";
import { AccountService } from "./services/account.service";
import {
  AuthCookieService,
  REFRESH_COOKIE_NAME,
} from "./services/auth-cookie.service";
import { RequestSecurityService } from "./services/request-security.service";
import type { RequestContext, SessionIssue } from "./services/session.service";
import { SessionService } from "./services/session.service";

@ApiTags("Authentication")
@Controller("auth")
export class AccountController {
  constructor(
    private readonly accounts: AccountService,
    private readonly sessions: SessionService,
    private readonly cookies: AuthCookieService,
    private readonly requestSecurity: RequestSecurityService,
  ) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register and start an authenticated session" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async register(
    @Body() input: RegisterDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponseDto> {
    this.requestSecurity.verifyOrigin(this.header(request, "origin"));
    return this.respondWithSession(
      await this.accounts.register(input, this.context(request)),
      reply,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  @ApiOperation({ summary: "Sign in and start an authenticated session" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async login(
    @Body() input: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponseDto> {
    this.requestSecurity.verifyOrigin(this.header(request, "origin"));
    return this.respondWithSession(
      await this.accounts.login(input, this.context(request)),
      reply,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("bootstrap")
  @ApiOperation({
    summary: "Restore the browser session without rotating the refresh token",
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async bootstrap(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthSessionResponseDto> {
    this.requestSecurity.verifyOrigin(this.header(request, "origin"));
    return this.respondWithSession(
      await this.sessions.bootstrap(this.refreshToken(request)),
      reply,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  @ApiOperation({
    summary: "Rotate the refresh token and issue a fresh access token",
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("x-csrf-token") csrfToken?: string,
  ): Promise<AuthSessionResponseDto> {
    const refreshToken = this.refreshToken(request);
    this.requestSecurity.verifyOrigin(this.header(request, "origin"));
    this.requestSecurity.verifyCsrf(
      this.sessions.csrfToken(refreshToken ?? ""),
      csrfToken,
    );
    return this.respondWithSession(
      await this.sessions.refresh(refreshToken, this.context(request)),
      reply,
    );
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("logout")
  @ApiOperation({ summary: "End the current session or every account session" })
  @ApiNoContentResponse()
  async logout(
    @Body() input: LogoutDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Headers("x-csrf-token") csrfToken?: string,
  ): Promise<void> {
    const refreshToken = this.refreshToken(request);
    this.requestSecurity.verifyOrigin(this.header(request, "origin"));
    if (refreshToken)
      this.requestSecurity.verifyCsrf(
        this.sessions.csrfToken(refreshToken),
        csrfToken,
      );
    await this.sessions.logout(refreshToken, input.scope);
    this.cookies.clear(reply);
  }

  @Get("me")
  @ApiBearerAuth()
  @RequirePermissions("account:read")
  @ApiOkResponse({ type: AuthAccountDto })
  async me(@CurrentUser() user: AuthContext): Promise<AuthAccountDto> {
    const account = await this.accounts.getMe(user.id);
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      roles: account.roles,
      permissions: account.permissions,
    };
  }

  @Get("sessions")
  @ApiBearerAuth()
  @RequirePermissions("sessions:read")
  @ApiOkResponse({ type: AuthSessionListItemDto, isArray: true })
  listSessions(
    @CurrentUser() user: AuthContext,
  ): Promise<AuthSessionListItemDto[]> {
    return this.sessions.list(user.id, user.sessionId);
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @RequirePermissions("sessions:revoke")
  @ApiNoContentResponse()
  revokeSession(
    @CurrentUser() user: AuthContext,
    @Param("sessionId") sessionId: string,
  ): Promise<void> {
    return this.sessions.revoke(user.id, sessionId);
  }

  private respondWithSession(
    session: SessionIssue,
    reply: FastifyReply,
  ): AuthSessionResponseDto {
    this.cookies.set(reply, session.refreshToken);
    return {
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      csrfToken: session.csrfToken,
      account: session.account,
    };
  }

  private context(request: FastifyRequest): RequestContext {
    return {
      ip: request.ip,
      userAgent: this.header(request, "user-agent"),
      traceId: request.id,
    };
  }

  private refreshToken(request: FastifyRequest): string | undefined {
    return request.cookies[REFRESH_COOKIE_NAME];
  }

  private header(request: FastifyRequest, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
