import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply } from "fastify";

import {
  configBoolean,
  configNumber,
} from "../../../common/config/config-values";

export const REFRESH_COOKIE_NAME = "refresh_token";

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  set(reply: FastifyReply, token: string): void {
    reply.setCookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: configBoolean(this.config, "AUTH_COOKIE_SECURE"),
      sameSite: "lax",
      path: "/api/auth",
      maxAge: configNumber(this.config, "AUTH_REFRESH_ABSOLUTE_DAYS") * 86_400,
    });
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: configBoolean(this.config, "AUTH_COOKIE_SECURE"),
      sameSite: "lax",
      path: "/api/auth",
    });
  }
}
