import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";

import { ATLAS_ERROR_CODES, ATLAS_PRODUCT_NAME } from "@atlas/shared";

import { env } from "./config/env.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";

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
    const atlasError = error as { statusCode?: unknown; message?: unknown };
    const statusCode = typeof atlasError.statusCode === "number" ? atlasError.statusCode : 500;
    const message = typeof atlasError.message === "string" ? atlasError.message : "Request failed.";
    const code = statusCode === 404 ? ATLAS_ERROR_CODES.NOT_FOUND : ATLAS_ERROR_CODES.INTERNAL;
    return reply.status(statusCode).send({
      error: {
        code,
        message: statusCode === 500 ? "Internal server error." : message,
        requestId: request.id,
        details: {},
      },
    });
  });

  await app.register(registerHealthRoutes);

  return app;
}
