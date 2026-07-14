import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@atlas/shared";

import { env } from "../../config/env.js";
import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams } from "../../shared/validation.js";
import { AuthService } from "./auth.service.js";

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });
const REFRESH_COOKIE = "atlas_refresh";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.authService.register(parseBody(request, registerRequestSchema), {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.setRefreshCookie(reply, result.refreshToken);
    return reply.status(201).send(result);
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.authService.login(parseBody(request, loginRequestSchema), {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    this.setRefreshCookie(reply, result.refreshToken);
    return result;
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = refreshRequestSchema.parse(request.body ?? {});
    const cookieToken = (request.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
    const result = await this.authService.refresh(
      { refreshToken: body.refreshToken ?? cookieToken },
      {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
    );
    this.setRefreshCookie(reply, result.refreshToken);
    return result;
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.authService.logout(await requireAuth(request));
    this.clearRefreshCookie(reply);
    return result;
  };

  me = async (request: FastifyRequest) => this.authService.me(await requireAuth(request));

  listSessions = async (request: FastifyRequest) => this.authService.listSessions(await requireAuth(request));

  revokeSession = async (request: FastifyRequest) => {
    const { sessionId } = parseParams(request, sessionParamsSchema);
    return this.authService.revokeSession(await requireAuth(request), sessionId);
  };

  revokeOtherSessions = async (request: FastifyRequest) => this.authService.revokeOtherSessions(await requireAuth(request));

  requestEmailVerification = async (request: FastifyRequest) =>
    this.authService.requestEmailVerification(await requireAuth(request));

  verifyEmail = async (request: FastifyRequest) => this.authService.verifyEmail(parseBody(request, verifyEmailSchema));

  requestPasswordReset = async (request: FastifyRequest) =>
    this.authService.requestPasswordReset(parseBody(request, requestPasswordResetSchema));

  resetPassword = async (request: FastifyRequest) => this.authService.resetPassword(parseBody(request, resetPasswordSchema));

  private setRefreshCookie(reply: FastifyReply, refreshToken: string) {
    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/api/v1/auth",
      sameSite: "lax",
      secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
    });
  }

  private clearRefreshCookie(reply: FastifyReply) {
    reply.clearCookie(REFRESH_COOKIE, {
      path: "/api/v1/auth",
    });
  }
}
