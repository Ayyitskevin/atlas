import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { loginRequestSchema, refreshRequestSchema, registerRequestSchema } from "@atlas/shared";
import { prisma } from "@atlas/db";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AuthController(new AuthService(new AuthRepository(prisma)));

  app.post("/auth/register", { schema: openApiSchema({ body: registerRequestSchema, tags: ["Auth"] }) }, controller.register);
  app.post("/auth/login", { schema: openApiSchema({ body: loginRequestSchema, tags: ["Auth"] }) }, controller.login);
  app.post("/auth/refresh", { schema: openApiSchema({ body: refreshRequestSchema, tags: ["Auth"] }) }, controller.refresh);
  app.post("/auth/logout", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.logout);
  app.get("/auth/me", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.me);
  app.get("/auth/sessions", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.listSessions);
  app.delete("/auth/sessions/:sessionId", { schema: openApiSchema({ params: sessionParamsSchema, tags: ["Auth"] }) }, controller.revokeSession);
  app.post("/auth/sessions/revoke-other", { schema: openApiSchema({ tags: ["Auth"] }) }, controller.revokeOtherSessions);
}
