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
    const outboxBefore = await prisma.domainEventOutbox.count();

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

    const attachment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { fileName: "brief.pdf", mimeType: "application/pdf", sizeBytes: 2048 },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/attachments",
    });
    expect(attachment.statusCode).toBe(201);
    const attachmentBody = attachment.json<{ attachment: { id: string; objectKey: string }; upload: { method: string; objectKey: string; url: string } }>();
    expect(attachmentBody.attachment.objectKey).toContain("workspaces/" + workspaceId + "/tasks/" + taskId + "/");
    expect(attachmentBody.upload.method).toBe("PUT");
    expect(attachmentBody.upload.objectKey).toBe(attachmentBody.attachment.objectKey);
    expect(attachmentBody.upload.url).toContain("X-Amz-Signature");

    const attachments = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/attachments",
    });
    expect(attachments.statusCode).toBe(200);
    expect(attachments.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const download = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/attachments/" + attachmentBody.attachment.id + "/download",
    });
    expect(download.statusCode).toBe(200);
    const downloadBody = download.json<{ download: { method: string; url: string } }>();
    expect(downloadBody.download.method).toBe("GET");
    expect(downloadBody.download.url).toContain("X-Amz-Signature");

    const deleteAttachment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/attachments/" + attachmentBody.attachment.id,
    });
    expect(deleteAttachment.statusCode).toBe(200);

    const outboxAfter = await prisma.domainEventOutbox.count();
    expect(outboxAfter).toBeGreaterThan(outboxBefore);
  }, 60_000);

  it("invalidates access tokens after logout", async () => {
    const logoutEmail = "atlas-logout-" + randomUUID() + "@example.com";
    const register = await app!.inject({
      method: "POST",
      payload: { email: logoutEmail, name: "Logout User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    const logoutToken = register.json<{ accessToken: string }>().accessToken;

    const beforeLogout = await app!.inject({
      headers: authHeaders(logoutToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(beforeLogout.statusCode).toBe(200);

    const logout = await app!.inject({
      headers: authHeaders(logoutToken),
      method: "POST",
      url: "/api/v1/auth/logout",
    });
    expect(logout.statusCode).toBe(200);

    const afterLogout = await app!.inject({
      headers: authHeaders(logoutToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it("revokes a refresh token family when an old refresh token is reused", async () => {
    const replayEmail = "atlas-refresh-replay-" + randomUUID() + "@example.com";
    const register = await app!.inject({
      method: "POST",
      payload: { email: replayEmail, name: "Refresh Replay User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    const firstPair = register.json<{ accessToken: string; refreshToken: string }>();

    const refresh = await app!.inject({
      method: "POST",
      payload: { refreshToken: firstPair.refreshToken },
      url: "/api/v1/auth/refresh",
    });
    expect(refresh.statusCode).toBe(200);
    const secondPair = refresh.json<{ accessToken: string; refreshToken: string }>();

    const reusedRefresh = await app!.inject({
      method: "POST",
      payload: { refreshToken: firstPair.refreshToken },
      url: "/api/v1/auth/refresh",
    });
    expect(reusedRefresh.statusCode).toBe(401);

    const revokedAccess = await app!.inject({
      headers: authHeaders(secondPair.accessToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(revokedAccess.statusCode).toBe(401);

    const revokedRefresh = await app!.inject({
      method: "POST",
      payload: { refreshToken: secondPair.refreshToken },
      url: "/api/v1/auth/refresh",
    });
    expect(revokedRefresh.statusCode).toBe(401);
  });

  it("lists and revokes user sessions", async () => {
    const sessionsEmail = "atlas-sessions-" + randomUUID() + "@example.com";
    const register = await app!.inject({
      method: "POST",
      payload: { email: sessionsEmail, name: "Sessions User", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(register.statusCode).toBe(201);
    const firstAccessToken = register.json<{ accessToken: string }>().accessToken;

    const login = await app!.inject({
      method: "POST",
      payload: { email: sessionsEmail, password: "integration-password" },
      url: "/api/v1/auth/login",
    });
    expect(login.statusCode).toBe(200);
    const secondAccessToken = login.json<{ accessToken: string }>().accessToken;

    const sessions = await app!.inject({
      headers: authHeaders(firstAccessToken),
      method: "GET",
      url: "/api/v1/auth/sessions",
    });
    expect(sessions.statusCode).toBe(200);
    const sessionItems = sessions.json<{ items: Array<{ current: boolean; id: string }> }>().items;
    expect(sessionItems).toHaveLength(2);
    const otherSession = sessionItems.find((item) => !item.current);
    expect(otherSession).toBeDefined();

    const revoke = await app!.inject({
      headers: authHeaders(firstAccessToken),
      method: "DELETE",
      url: "/api/v1/auth/sessions/" + otherSession!.id,
    });
    expect(revoke.statusCode).toBe(200);

    const revokedAccess = await app!.inject({
      headers: authHeaders(secondAccessToken),
      method: "GET",
      url: "/api/v1/auth/me",
    });
    expect(revokedAccess.statusCode).toBe(401);

    const remainingSessions = await app!.inject({
      headers: authHeaders(firstAccessToken),
      method: "GET",
      url: "/api/v1/auth/sessions",
    });
    expect(remainingSessions.statusCode).toBe(200);
    expect(remainingSessions.json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  it("rejects owner role invitations", async () => {
    const ownerInvite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { email: "atlas-owner-invite-" + randomUUID() + "@example.com", role: "OWNER" },
      url: "/api/v1/workspaces/" + workspaceId + "/invitations",
    });
    expect(ownerInvite.statusCode).toBe(400);
    expect(ownerInvite.json<{ error: { code: string } }>().error.code).toBe("ATLAS_VALIDATION_FAILED");
  });

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

  it("supports pending invitations, member changes, removal, and owner transfer", async () => {
    const lifecycleWorkspace = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Lifecycle Workspace", slug: "lifecycle-" + randomUUID().slice(0, 8) },
      url: "/api/v1/workspaces",
    });
    expect(lifecycleWorkspace.statusCode).toBe(201);
    const lifecycleWorkspaceId = lifecycleWorkspace.json<{ id: string }>().id;

    const firstEmail = "atlas-lifecycle-first-" + randomUUID() + "@example.com";
    const firstRegister = await app!.inject({
      method: "POST",
      payload: { email: firstEmail, name: "Lifecycle First", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(firstRegister.statusCode).toBe(201);
    const firstAccessToken = firstRegister.json<{ accessToken: string }>().accessToken;

    const firstInvite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { email: firstEmail, role: "GUEST" },
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(firstInvite.statusCode).toBe(201);
    const firstInviteBody = firstInvite.json<{ acceptToken: string; id: string }>();

    const listInvitations = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(listInvitations.statusCode).toBe(200);
    expect(listInvitations.json<{ items: unknown[] }>().items).toHaveLength(1);

    const resend = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations/" + firstInviteBody.id + "/resend",
    });
    expect(resend.statusCode).toBe(200);
    const resentToken = resend.json<{ acceptToken: string }>().acceptToken;

    const oldTokenAccept = await app!.inject({
      headers: authHeaders(firstAccessToken),
      method: "POST",
      payload: { token: firstInviteBody.acceptToken },
      url: "/api/v1/workspaces/invitations/accept",
    });
    expect(oldTokenAccept.statusCode).toBe(404);

    const firstAccept = await app!.inject({
      headers: authHeaders(firstAccessToken),
      method: "POST",
      payload: { token: resentToken },
      url: "/api/v1/workspaces/invitations/accept",
    });
    expect(firstAccept.statusCode).toBe(200);

    const updateMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { role: "MEMBER" },
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/members/" + firstAccept.json<{ member: { userId: string } }>().member.userId,
    });
    expect(updateMember.statusCode).toBe(200);

    const removeMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/members/" + firstAccept.json<{ member: { userId: string } }>().member.userId,
    });
    expect(removeMember.statusCode).toBe(200);

    const secondEmail = "atlas-lifecycle-owner-" + randomUUID() + "@example.com";
    const secondRegister = await app!.inject({
      method: "POST",
      payload: { email: secondEmail, name: "Lifecycle Owner", password: "integration-password" },
      url: "/api/v1/auth/register",
    });
    expect(secondRegister.statusCode).toBe(201);
    const secondAccessToken = secondRegister.json<{ accessToken: string }>().accessToken;

    const secondInvite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { email: secondEmail, role: "ADMIN" },
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(secondInvite.statusCode).toBe(201);

    const secondAccept = await app!.inject({
      headers: authHeaders(secondAccessToken),
      method: "POST",
      payload: { token: secondInvite.json<{ acceptToken: string }>().acceptToken },
      url: "/api/v1/workspaces/invitations/accept",
    });
    expect(secondAccept.statusCode).toBe(200);
    const newOwnerId = secondAccept.json<{ member: { userId: string } }>().member.userId;

    const transferOwner = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { userId: newOwnerId },
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/owner-transfer",
    });
    expect(transferOwner.statusCode).toBe(200);

    const removeOwner = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/members/" + newOwnerId,
    });
    expect(removeOwner.statusCode).toBe(403);
  }, 60_000);

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
    const accept = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "POST",
      payload: { token: invite.json<{ acceptToken: string }>().acceptToken },
      url: "/api/v1/workspaces/invitations/accept",
    });
    expect(accept.statusCode).toBe(200);

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
