import type { FastifyInstance } from "fastify";
import { Redis } from "ioredis";

import { prisma } from "@atlas/db";

import { env } from "../../config/env.js";

type ReadinessCheck = () => Promise<void>;

export type ReadinessChecks = {
  database: ReadinessCheck;
  redis: ReadinessCheck;
};

type HealthRouteOptions = {
  checks?: ReadinessChecks;
};

export async function registerHealthRoutes(app: FastifyInstance, options: HealthRouteOptions = {}): Promise<void> {
  const checks = options.checks ?? defaultReadinessChecks;

  app.get("/healthz", async () => ({
    status: "ok",
    service: "atlas-api",
  }));

  app.get("/readyz", async (_request, reply) => {
    const [database, redis] = await Promise.all([runReadinessCheck(checks.database), runReadinessCheck(checks.redis)]);
    const ready = database === "ok" && redis === "ok";
    return reply.status(ready ? 200 : 503).send({
      status: ready ? "ok" : "error",
      checks: {
        api: "ok",
        database,
        redis,
      },
    });
  });
}

const defaultReadinessChecks = {
  database: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
  redis: async () => {
    const client = new Redis(env.REDIS_URL, {
      connectTimeout: 1000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    client.on("error", () => undefined);
    try {
      await client.connect();
      await client.ping();
    } finally {
      client.disconnect();
    }
  },
} satisfies ReadinessChecks;

async function runReadinessCheck(check: ReadinessCheck) {
  try {
    await check();
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}
