import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { env } from "../../config/env.js";
import { openApiSchema } from "../../shared/zod-openapi.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });

const authRateLimit = {
  config: {
    rateLimit: {
      max: env.AUTH_RATE_LIMIT_MAX,
      timeWindow: env.AUTH_RATE_LIMIT_WINDOW,
    },
  },
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AuthController(new AuthService(new AuthRepository(prisma)));

  app.post(
    "/auth/register",
    { ...authRateLimit, schema: openApiSchema({ body: registerRequestSchema, tags: ["Auth"] }) },
    controller.register,
  );
  app.post(
    "/auth/login",
    { ...authRateLimit, schema: openApiSchema({ body: loginRequestSchema, tags: ["Auth"] }) },
    controller.login,
  );
  app.post(
    "/auth/refresh",
    { ...authRateLimit, schema: openApiSchema({ body: refreshRequestSchema, tags: ["Auth"] }) },
    controller.refresh,
  );
  app.post("/auth/logout", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.logout);
  app.get("/auth/me", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.me);
  app.get("/auth/sessions", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.listSessions);
  app.delete(
    "/auth/sessions/:sessionId",
    { schema: openApiSchema({ params: sessionParamsSchema, tags: ["Auth"] }) },
    controller.revokeSession,
  );
  app.post("/auth/sessions/revoke-other", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.revokeOtherSessions);
  app.post(
    "/auth/email/request-verification",
    { ...authRateLimit, schema: openApiSchema({ tags: ["Auth"] }) },
    controller.requestEmailVerification,
  );
  app.post(
    "/auth/email/verify",
    { ...authRateLimit, schema: openApiSchema({ body: verifyEmailSchema, tags: ["Auth"] }) },
    controller.verifyEmail,
  );
  app.post(
    "/auth/password/request-reset",
    { ...authRateLimit, schema: openApiSchema({ body: requestPasswordResetSchema, tags: ["Auth"] }) },
    controller.requestPasswordReset,
  );
  app.post(
    "/auth/password/reset",
    { ...authRateLimit, schema: openApiSchema({ body: resetPasswordSchema, tags: ["Auth"] }) },
    controller.resetPassword,
  );
}
