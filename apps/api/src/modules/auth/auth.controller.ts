import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { loginRequestSchema, refreshRequestSchema, registerRequestSchema } from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams } from "../../shared/validation.js";
import { AuthService } from "./auth.service.js";

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.authService.register(parseBody(request, registerRequestSchema), {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.status(201).send(result);
  };

  login = async (request: FastifyRequest) =>
    this.authService.login(parseBody(request, loginRequestSchema), {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

  refresh = async (request: FastifyRequest) =>
    this.authService.refresh(parseBody(request, refreshRequestSchema), {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

  logout = async (request: FastifyRequest) => this.authService.logout(await requireAuth(request));

  me = async (request: FastifyRequest) => this.authService.me(await requireAuth(request));

  listSessions = async (request: FastifyRequest) => this.authService.listSessions(await requireAuth(request));

  revokeSession = async (request: FastifyRequest) => {
    const { sessionId } = parseParams(request, sessionParamsSchema);
    return this.authService.revokeSession(await requireAuth(request), sessionId);
  };

  revokeOtherSessions = async (request: FastifyRequest) => this.authService.revokeOtherSessions(await requireAuth(request));
}
