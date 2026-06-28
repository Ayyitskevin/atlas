import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@atlas/db";

import { buildApp } from "../../src/app.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("API integration flow", () => {
  const email = "atlas-" + randomUUID() + "@example.com";
  const memberEmail = "atlas-member-" + randomUUID() + "@example.com";
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let accessToken = "";
  let memberAccessToken = "";
  let workspaceId = "";
  let projectId = "";
  let sectionId = "";
  let taskId = "";
  let secondProjectId = "";
  let secondSectionId = "";
  let privateProjectId = "";

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
    const register = await app!.inject({
      method: "POST",
      payload: { email, name: "Integration User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    accessToken = register.json<{ accessToken: string }>().accessToken;

    const workspace = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Integration Workspace", slug: "integration-" + randomUUID().slice(0, 8) },
      url: "/api/v1/workspaces",
    });
    expect(workspace.statusCode).toBe(201);
    workspaceId = workspace.json<{ id: string }>().id;

    const project = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Integration Project", visibility: "WORKSPACE" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects",
    });
    expect(project.statusCode).toBe(201);
    projectId = project.json<{ id: string }>().id;

    const section = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "To Do", position: 1000 },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/sections",
    });
    expect(section.statusCode).toBe(201);
    sectionId = section.json<{ id: string }>().id;

    const task = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId, title: "Integration task" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/tasks",
    });
    expect(task.statusCode).toBe(201);
    taskId = task.json<{ id: string }>().id;

    const comment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { body: "Integration comment" },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/comments",
    });
    expect(comment.statusCode).toBe(201);
  }, 60_000);

  it("rejects cross-project section references for create and move", async () => {
    const secondProject = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Second Project", visibility: "WORKSPACE" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects",
    });
    expect(secondProject.statusCode).toBe(201);
    secondProjectId = secondProject.json<{ id: string }>().id;

    const secondSection = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Other Project Section", position: 2000 },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + secondProjectId + "/sections",
    });
    expect(secondSection.statusCode).toBe(201);
    secondSectionId = secondSection.json<{ id: string }>().id;

    const crossProjectCreate = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId: secondSectionId, title: "Should not cross projects" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/tasks",
    });
    expect(crossProjectCreate.statusCode).toBe(404);

    const crossProjectMove = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { position: 3000, sectionId: secondSectionId, version: 0 },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/move",
    });
    expect(crossProjectMove.statusCode).toBe(404);
  });

  it("does not leak private project search or workspace activity to ordinary members", async () => {
    const memberRegister = await app!.inject({
      method: "POST",
      payload: { email: memberEmail, name: "Workspace Member", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(memberRegister.statusCode).toBe(201);
    memberAccessToken = memberRegister.json<{ accessToken: string }>().accessToken;

    const invite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { email: memberEmail, role: "MEMBER" },
      url: "/api/v1/workspaces/" + workspaceId + "/invitations",
    });
    expect(invite.statusCode).toBe(201);

    const privateProject = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Private Integration Project", visibility: "PRIVATE" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects",
    });
    expect(privateProject.statusCode).toBe(201);
    privateProjectId = privateProject.json<{ id: string }>().id;

    const privateSection = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Private", position: 4000 },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/sections",
    });
    expect(privateSection.statusCode).toBe(201);

    const secretTitle = "secret-private-" + randomUUID();
    const privateTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId: privateSection.json<{ id: string }>().id, title: secretTitle },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/tasks",
    });
    expect(privateTask.statusCode).toBe(201);

    const memberSearch = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent(secretTitle),
    });
    expect(memberSearch.statusCode).toBe(200);
    expect(memberSearch.json<{ items: unknown[] }>().items).toHaveLength(0);

    const memberWorkspaceActivity = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/activity",
    });
    expect(memberWorkspaceActivity.statusCode).toBe(403);

    const memberPrivateActivity = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/activity",
    });
    expect(memberPrivateActivity.statusCode).toBe(403);

    const ownerPrivateActivity = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/activity",
    });
    expect(ownerPrivateActivity.statusCode).toBe(200);
  }, 60_000);
});

function authHeaders(accessToken: string) {
  return { authorization: "Bearer " + accessToken };
}
