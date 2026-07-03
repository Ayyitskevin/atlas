import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerHealthRoutes, type ReadinessChecks } from "../../src/modules/health/health.routes.js";

type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

let app: TestApp | undefined;

afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe("health routes", () => {
  it("keeps liveness independent from downstream dependencies", async () => {
    app = await buildTestApp({
      database: async () => {
        throw new Error("database unavailable");
      },
      redis: async () => {
        throw new Error("redis unavailable");
      },
    });

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: "atlas-api", status: "ok" });
  });

  it("returns ready when database and redis checks pass", async () => {
    app = await buildTestApp({
      database: async () => undefined,
      redis: async () => undefined,
    });

    const response = await app.inject({ method: "GET", url: "/readyz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checks: { api: "ok", database: "ok", redis: "ok" },
      status: "ok",
    });
  });

  it("returns unavailable when a dependency check fails", async () => {
    app = await buildTestApp({
      database: async () => {
        throw new Error("database unavailable");
      },
      redis: async () => undefined,
    });

    const response = await app.inject({ method: "GET", url: "/readyz" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      checks: { api: "ok", database: "error", redis: "ok" },
      status: "error",
    });
  });
});

async function buildTestApp(checks: ReadinessChecks) {
  const fastify = Fastify({ logger: false });
  await registerHealthRoutes(fastify, { checks });
  return fastify;
}
