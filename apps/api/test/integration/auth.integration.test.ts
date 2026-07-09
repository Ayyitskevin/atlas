import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type IntegrationHarness,
  authHeader,
  startIntegrationApp,
  stopIntegrationApp,
} from "./helpers/app-harness.js";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

/**
 * Domain slice: auth happy path.
 * Full golden path remains in api-flow.test.ts until more suites are carved out.
 */
describe.skipIf(!hasDatabaseUrl)("integration · auth", () => {
  let harness: IntegrationHarness | undefined;
  const email = `atlas-auth-${randomUUID()}@example.com`;
  const password = "integration-password";
  let accessToken = "";
  let refreshToken = "";

  beforeAll(async () => {
    harness = await startIntegrationApp();
  }, 60_000);

  afterAll(async () => {
    await stopIntegrationApp(harness);
  });

  it("reports readiness when database and redis are reachable", async () => {
    const readiness = await harness!.app.inject({ method: "GET", url: "/readyz" });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toMatchObject({
      checks: { api: "ok", database: "ok", redis: "ok" },
      status: "ok",
    });
  });

  it("registers and returns a bearer session pair", async () => {
    const register = await harness!.app.inject({
      method: "POST",
      payload: { email, name: "Auth Slice User", password },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    const body = register.json<{ accessToken: string; refreshToken: string; tokenType: string }>();
    expect(body.tokenType).toBe("Bearer");
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("returns the current user on /auth/me", async () => {
    const me = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email, name: "Auth Slice User" },
    });
  });

  it("logs in with the same credentials", async () => {
    const login = await harness!.app.inject({
      method: "POST",
      payload: { email, password },
      url: "/api/v1/auth/login",
    });
    expect(login.statusCode).toBe(200);
    const body = login.json<{ accessToken: string; refreshToken: string }>();
    expect(body.accessToken).toBeTruthy();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("refreshes the session", async () => {
    const refresh = await harness!.app.inject({
      method: "POST",
      payload: { refreshToken },
      url: "/api/v1/auth/refresh",
    });
    expect(refresh.statusCode).toBe(200);
    const body = refresh.json<{ accessToken: string; refreshToken: string }>();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("logs out and rejects the old refresh token", async () => {
    const logout = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { refreshToken },
      url: "/api/v1/auth/logout",
    });
    expect(logout.statusCode).toBe(200);

    const refresh = await harness!.app.inject({
      method: "POST",
      payload: { refreshToken },
      url: "/api/v1/auth/refresh",
    });
    expect(refresh.statusCode).toBeGreaterThanOrEqual(400);
  });
});
