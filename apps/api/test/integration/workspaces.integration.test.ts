import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type IntegrationHarness,
  authHeader,
  startIntegrationApp,
  stopIntegrationApp,
} from "./helpers/app-harness.js";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)("integration · workspaces", () => {
  let harness: IntegrationHarness | undefined;
  const email = `atlas-ws-${randomUUID()}@example.com`;
  const password = "integration-password";
  let accessToken = "";
  let workspaceId = "";

  beforeAll(async () => {
    harness = await startIntegrationApp();
    const register = await harness.app.inject({
      method: "POST",
      payload: { email, name: "Workspace Slice User", password },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    accessToken = register.json<{ accessToken: string }>().accessToken;
  }, 60_000);

  afterAll(async () => {
    await stopIntegrationApp(harness);
  });

  it("creates and lists a workspace", async () => {
    const slug = `ws-${randomUUID().slice(0, 8)}`;
    const create = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { name: "Workspace Slice", slug },
      url: "/api/v1/workspaces",
    });
    expect(create.statusCode).toBe(201);
    workspaceId = create.json<{ id: string }>().id;
    expect(workspaceId).toBeTruthy();

    const list = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: "/api/v1/workspaces",
    });
    expect(list.statusCode).toBe(200);
    const items = list.json<{ items: Array<{ id: string; name: string }> }>().items;
    expect(items.some((workspace) => workspace.id === workspaceId)).toBe(true);
  });

  it("reads workspace detail and members", async () => {
    const detail = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: workspaceId, name: "Workspace Slice" });

    const members = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/members`,
    });
    expect(members.statusCode).toBe(200);
    const body = members.json<{ items?: unknown[] } | unknown[]>();
    const list = Array.isArray(body) ? body : body.items;
    expect(Array.isArray(list)).toBe(true);
    expect((list as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("updates workspace name", async () => {
    const patch = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      payload: { name: "Workspace Slice Renamed" },
      url: `/api/v1/workspaces/${workspaceId}`,
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ id: workspaceId, name: "Workspace Slice Renamed" });
  });
});
