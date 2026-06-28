import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({
    status: "ok",
    service: "atlas-api",
  }));

  app.get("/readyz", async () => ({
    status: "ok",
    checks: {
      api: "ok",
    },
  }));
}
