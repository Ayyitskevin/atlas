import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { ATLAS_API_PREFIX, ATLAS_ERROR_CODES, ATLAS_PRODUCT_NAME } from "@atlas/shared";

import { env } from "./config/env.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { registerOutboxRoutes } from "./modules/outbox/outbox.routes.js";
import { registerProjectRoutes } from "./modules/projects/projects.routes.js";
import { registerWorkRoutes } from "./modules/work/work.routes.js";
import { registerRealtimeRoutes } from "./realtime/realtime.routes.js";
import { registerWorkspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
import { AtlasHttpError } from "./shared/errors.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization", "password", "refreshToken"],
    },
    requestIdHeader: "x-request-id",
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });
  await app.register(websocket);
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${ATLAS_PRODUCT_NAME} API`,
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "request failed");
    const atlasError = error as { statusCode?: unknown; message?: unknown; validation?: unknown };
    const statusCode = typeof atlasError.statusCode === "number" ? atlasError.statusCode : 500;
    const message = typeof atlasError.message === "string" ? atlasError.message : "Request failed.";
    const code = error instanceof AtlasHttpError ? error.code : errorCodeForStatus(statusCode, atlasError.validation);
    const details = error instanceof AtlasHttpError ? error.details : detailsForError(atlasError.validation);
    return reply.status(statusCode).send({
      error: {
        code,
        message: statusCode === 500 ? "Internal server error." : message,
        requestId: request.id,
        details,
      },
    });
  });

  await app.register(registerHealthRoutes);
  await app.register(registerAuthRoutes, { prefix: ATLAS_API_PREFIX });
  await app.register(registerWorkspaceRoutes, { prefix: ATLAS_API_PREFIX });
  await app.register(registerProjectRoutes, { prefix: ATLAS_API_PREFIX });
  await app.register(registerWorkRoutes, { prefix: ATLAS_API_PREFIX });
  await app.register(registerOutboxRoutes, { prefix: ATLAS_API_PREFIX });
  await app.register(registerRealtimeRoutes, { prefix: ATLAS_API_PREFIX });

  return app;
}

function errorCodeForStatus(statusCode: number, validation: unknown) {
  if (validation) return ATLAS_ERROR_CODES.VALIDATION_FAILED;
  if (statusCode === 400) return ATLAS_ERROR_CODES.BAD_REQUEST;
  if (statusCode === 401) return ATLAS_ERROR_CODES.UNAUTHORIZED;
  if (statusCode === 403) return ATLAS_ERROR_CODES.FORBIDDEN;
  if (statusCode === 404) return ATLAS_ERROR_CODES.NOT_FOUND;
  if (statusCode === 409) return ATLAS_ERROR_CODES.CONFLICT;
  if (statusCode === 429) return ATLAS_ERROR_CODES.RATE_LIMITED;
  return ATLAS_ERROR_CODES.INTERNAL;
}

function detailsForError(validation: unknown): Record<string, unknown> {
  return validation ? { validation } : {};
}
