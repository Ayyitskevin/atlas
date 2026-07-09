import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type IntegrationHarness,
  authHeader,
  startIntegrationApp,
  stopIntegrationApp,
} from "./helpers/app-harness.js";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)("integration · tasks board", () => {
  let harness: IntegrationHarness | undefined;
  const email = `atlas-tasks-${randomUUID()}@example.com`;
  let accessToken = "";
  let workspaceId = "";
  let projectId = "";
  let sectionId = "";
  let taskId = "";

  beforeAll(async () => {
    harness = await startIntegrationApp();
    const register = await harness.app.inject({
      method: "POST",
      payload: { email, name: "Tasks Slice User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    accessToken = register.json<{ accessToken: string }>().accessToken;

    const workspace = await harness.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { name: "Tasks Workspace", slug: `tasks-${randomUUID().slice(0, 8)}` },
      url: "/api/v1/workspaces",
    });
    expect(workspace.statusCode).toBe(201);
    workspaceId = workspace.json<{ id: string }>().id;

    const project = await harness.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { name: "Board Project", visibility: "WORKSPACE" },
      url: `/api/v1/workspaces/${workspaceId}/projects`,
    });
    expect(project.statusCode).toBe(201);
    projectId = project.json<{ id: string }>().id;
  }, 60_000);

  afterAll(async () => {
    await stopIntegrationApp(harness);
  });

  it("creates sections and lists them", async () => {
    const section = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { name: "To Do", position: 1000 },
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sections`,
    });
    expect(section.statusCode).toBe(201);
    sectionId = section.json<{ id: string }>().id;

    const list = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sections`,
    });
    expect(list.statusCode).toBe(200);
    const items = list.json<{ items: Array<{ id: string }> }>().items;
    expect(items.some((item) => item.id === sectionId)).toBe(true);
  });

  it("creates a task, updates it, and lists my work", async () => {
    const create = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { sectionId, title: "Board task" },
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    });
    expect(create.statusCode).toBe(201);
    const created = create.json<{ id: string; version: number }>();
    taskId = created.id;

    const patch = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "PATCH",
      payload: { priority: "HIGH", title: "Board task updated", version: created.version },
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json()).toMatchObject({ id: taskId, priority: "HIGH", title: "Board task updated" });

    const me = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    const userId = me.json<{ user: { id: string } }>().user.id;

    await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { userId },
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/assign`,
    });

    const myWork = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/my-work`,
    });
    expect(myWork.statusCode).toBe(200);
    const items = myWork.json<{ items: Array<{ id: string }> }>().items;
    expect(items.some((item) => item.id === taskId)).toBe(true);
  });

  it("moves a task between sections and completes it", async () => {
    const doing = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { name: "Doing", position: 2000 },
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sections`,
    });
    expect(doing.statusCode).toBe(201);
    const doingId = doing.json<{ id: string }>().id;

    const task = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "GET",
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
    });
    const version = task.json<{ version: number }>().version;

    const move = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { position: 1500, sectionId: doingId, version },
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/move`,
    });
    expect(move.statusCode).toBe(200);
    expect(move.json()).toMatchObject({ id: taskId, sectionId: doingId });

    const complete = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/complete`,
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json()).toMatchObject({ id: taskId, status: "DONE" });
  });

  it("adds a comment on the task", async () => {
    const comment = await harness!.app.inject({
      headers: authHeader(accessToken),
      method: "POST",
      payload: { body: "Tasks slice comment" },
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/comments`,
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json()).toMatchObject({ body: "Tasks slice comment", taskId });
  });
});
