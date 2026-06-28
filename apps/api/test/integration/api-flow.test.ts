import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@atlas/db";

import { buildApp } from "../../src/app.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("API integration flow", () => {
  const email = `atlas-${randomUUID()}@example.com`;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let accessToken = "";
  let workspaceId = "";
  let projectId = "";
  let sectionId = "";
  let taskId = "";

  beforeAll(async () => {
    execFileSync(
      "corepack",
      ["pnpm", "--filter", "@atlas/db", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
      { cwd: rootDir, env: process.env, stdio: "ignore" },
    );
    app = await buildApp();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it("registers, creates a workspace, project, section, task, and comment", async () => {
    const register = await app.inject({
      method: "POST",
      payload: { email, name: "Integration User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    accessToken = register.json<{ accessToken: string }>().accessToken;

    const workspace = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Integration Workspace", slug: `integration-${randomUUID().slice(0, 8)}` },
      url: "/api/v1/workspaces",
    });
    expect(workspace.statusCode).toBe(201);
    workspaceId = workspace.json<{ id: string }>().id;

    const project = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Integration Project", visibility: "WORKSPACE" },
      url: `/api/v1/workspaces/${workspaceId}/projects`,
    });
    expect(project.statusCode).toBe(201);
    projectId = project.json<{ id: string }>().id;

    const section = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "To Do", position: 1000 },
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/sections`,
    });
    expect(section.statusCode).toBe(201);
    sectionId = section.json<{ id: string }>().id;

    const task = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId, title: "Integration task" },
      url: `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`,
    });
    expect(task.statusCode).toBe(201);
    taskId = task.json<{ id: string }>().id;

    const comment = await app.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { body: "Integration comment" },
      url: `/api/v1/workspaces/${workspaceId}/tasks/${taskId}/comments`,
    });
    expect(comment.statusCode).toBe(201);
  }, 60_000);
});

function authHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}
