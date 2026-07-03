import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@atlas/db";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

type AtlasApp = Awaited<ReturnType<typeof import("../../src/app.js").buildApp>>;
type CloseDomainSideEffectQueues = typeof import("../../src/jobs/queues.js").closeDomainSideEffectQueues;
type DispatchOutboxEvent = typeof import("../../src/jobs/outbox.js").dispatchOutboxEvent;

describe.skipIf(!hasDatabaseUrl)("API integration flow", () => {
  const email = "atlas-" + randomUUID() + "@example.com";
  const memberEmail = "atlas-member-" + randomUUID() + "@example.com";
  let app: AtlasApp | undefined;
  let accessToken = "";
  let closeDomainSideEffectQueues: CloseDomainSideEffectQueues | undefined;
  let dispatchOutboxEvent: DispatchOutboxEvent | undefined;
  let memberAccessToken = "";
  let workspaceId = "";
  let projectId = "";
  let sectionId = "";
  let taskId = "";
  let secondProjectId = "";
  let secondSectionId = "";
  let privateProjectId = "";

  beforeAll(async () => {
    execFileSync("pnpm", ["--filter", "@atlas/db", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
      cwd: rootDir,
      env: process.env,
      stdio: "ignore",
    });
    const [{ buildApp }, outboxModule, queuesModule] = await Promise.all([
      import("../../src/app.js"),
      import("../../src/jobs/outbox.js"),
      import("../../src/jobs/queues.js"),
    ]);
    closeDomainSideEffectQueues = queuesModule.closeDomainSideEffectQueues;
    dispatchOutboxEvent = outboxModule.dispatchOutboxEvent;
    app = await buildApp();
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (closeDomainSideEffectQueues) await closeDomainSideEffectQueues();
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

    const scratchSection = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { name: "Scratch", position: 2000 },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/sections",
    });
    expect(scratchSection.statusCode).toBe(201);
    const scratchSectionId = scratchSection.json<{ id: string }>().id;

    const updateScratchSection = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { name: "In Review" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/sections/" + scratchSectionId,
    });
    expect(updateScratchSection.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: scratchSectionId,
      entityType: "section",
      eventType: "SectionUpdated",
      payload: { name: "In Review" },
      projectId,
      workspaceId,
    });

    const deleteScratchSection = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/sections/" + scratchSectionId,
    });
    expect(deleteScratchSection.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: scratchSectionId,
      entityType: "section",
      eventType: "SectionDeleted",
      payload: { name: "In Review" },
      projectId,
      workspaceId,
    });

    const task = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId, title: "Integration task" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/tasks",
    });
    expect(task.statusCode).toBe(201);
    taskId = task.json<{ id: string }>().id;
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskCreated",
      payload: { dueDate: null, priority: "MEDIUM", sectionId, status: "TODO", title: "Integration task" },
      projectId,
      taskId,
      workspaceId,
    });

    const comment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { body: "Integration comment" },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/comments",
    });
    expect(comment.statusCode).toBe(201);

    const unsupportedAttachmentType = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { fileName: "script.html", mimeType: "text/html", sizeBytes: 2048 },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/attachments",
    });
    expect(unsupportedAttachmentType.statusCode).toBe(400);

    const unsupportedAttachmentExtension = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { fileName: "run.exe", mimeType: "application/pdf", sizeBytes: 2048 },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/attachments",
    });
    expect(unsupportedAttachmentExtension.statusCode).toBe(400);

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

    const attachmentsAfterDelete = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/attachments",
    });
    expect(attachmentsAfterDelete.statusCode).toBe(200);
    expect(attachmentsAfterDelete.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ id: attachmentBody.attachment.id }),
    );
    await expectActivityEvent({
      entityId: attachmentBody.attachment.id,
      entityType: "attachment",
      eventType: "AttachmentDeleted",
      payload: { fileName: "brief.pdf", sizeBytes: 2048 },
      projectId,
      taskId,
      workspaceId,
    });

    const outboxAfter = await prisma.domainEventOutbox.count();
    expect(outboxAfter).toBeGreaterThan(outboxBefore);
  }, 60_000);

  it("records project lifecycle activity and outbox events", async () => {
    const name = "Project Lifecycle " + randomUUID().slice(0, 8);
    const project = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { description: "Lifecycle event coverage", name, visibility: "WORKSPACE" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects",
    });
    expect(project.statusCode).toBe(201);
    const lifecycleProjectId = project.json<{ id: string }>().id;
    await expectProjectLifecycleEvent(workspaceId, "ProjectCreated", lifecycleProjectId, { name, visibility: "WORKSPACE" });

    const update = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { description: "Updated lifecycle event coverage", name: name + " Updated", visibility: "PRIVATE" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + lifecycleProjectId,
    });
    expect(update.statusCode).toBe(200);
    await expectProjectLifecycleEvent(workspaceId, "ProjectUpdated", lifecycleProjectId, { name: name + " Updated", visibility: "PRIVATE" });

    const archive = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + lifecycleProjectId + "/archive",
    });
    expect(archive.statusCode).toBe(200);
    await expectProjectLifecycleEvent(workspaceId, "ProjectArchived", lifecycleProjectId, { name: name + " Updated", visibility: "PRIVATE" });

    const deleteProject = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + lifecycleProjectId,
    });
    expect(deleteProject.statusCode).toBe(200);
    await expectProjectLifecycleEvent(workspaceId, "ProjectDeleted", lifecycleProjectId, { name: name + " Updated", visibility: "PRIVATE" });
  }, 60_000);

  it("manages project message board posts", async () => {
    const createMessage = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { body: "Here is the weekly project update.", title: "Weekly update" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/messages",
    });
    expect(createMessage.statusCode).toBe(201);
    const messageBody = createMessage.json<{ author: { email: string; name: string }; body: string; id: string; title: string }>();
    expect(messageBody).toMatchObject({
      author: { email, name: "Integration User" },
      body: "Here is the weekly project update.",
      title: "Weekly update",
    });
    await expectActivityEvent({
      entityId: messageBody.id,
      entityType: "project_message",
      eventType: "ProjectMessageCreated",
      payload: { bodyPreview: "Here is the weekly project update.", title: "Weekly update" },
      projectId,
      workspaceId,
    });

    const messages = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/messages",
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json<{ items: Array<{ id: string; title: string }> }>().items).toContainEqual(
      expect.objectContaining({ id: messageBody.id, title: "Weekly update" }),
    );

    const updateMessage = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { body: "Updated weekly project notes.", title: "Weekly update edited" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/messages/" + messageBody.id,
    });
    expect(updateMessage.statusCode).toBe(200);
    expect(updateMessage.json<{ body: string; title: string }>()).toMatchObject({
      body: "Updated weekly project notes.",
      title: "Weekly update edited",
    });
    await expectActivityEvent({
      entityId: messageBody.id,
      entityType: "project_message",
      eventType: "ProjectMessageUpdated",
      payload: {
        bodyPreview: "Updated weekly project notes.",
        previousBodyPreview: "Here is the weekly project update.",
        previousTitle: "Weekly update",
        title: "Weekly update edited",
      },
      projectId,
      workspaceId,
    });

    const deleteMessage = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/messages/" + messageBody.id,
    });
    expect(deleteMessage.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: messageBody.id,
      entityType: "project_message",
      eventType: "ProjectMessageDeleted",
      payload: { bodyPreview: "Updated weekly project notes.", title: "Weekly update edited" },
      projectId,
      workspaceId,
    });

    const messagesAfterDelete = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + projectId + "/messages",
    });
    expect(messagesAfterDelete.statusCode).toBe(200);
    expect(messagesAfterDelete.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ id: messageBody.id }),
    );
  }, 60_000);

  it("updates task details, assignments, subtasks, and comments", async () => {
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    const currentTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId,
    });
    expect(currentTask.statusCode).toBe(200);
    const currentTaskBody = currentTask.json<{ version: number }>();

    const updateTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: {
        description: "Updated from the detail panel contract.",
        dueDate: "2026-07-02",
        priority: "HIGH",
        status: "IN_PROGRESS",
        title: "Updated integration task",
        version: currentTaskBody.version,
      },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId,
    });
    expect(updateTask.statusCode).toBe(200);
    const updateTaskBody = updateTask.json<{ description: string; dueDate: string | null; priority: string; status: string; title: string; version: number }>();
    expect(updateTaskBody).toMatchObject({
      description: "Updated from the detail panel contract.",
      priority: "HIGH",
      status: "IN_PROGRESS",
      title: "Updated integration task",
    });
    expect(updateTaskBody.dueDate?.startsWith("2026-07-02")).toBe(true);
    expect(updateTaskBody.version).toBe(currentTaskBody.version + 1);
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskUpdated",
      payload: {
        dueDate: "2026-07-02",
        previousDueDate: null,
        previousPriority: "MEDIUM",
        previousStatus: "TODO",
        previousTitle: "Integration task",
        priority: "HIGH",
        status: "IN_PROGRESS",
        title: "Updated integration task",
      },
      projectId,
      taskId,
      workspaceId,
    });

    const moveTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { position: 3000, sectionId, version: updateTaskBody.version },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/move",
    });
    expect(moveTask.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskMoved",
      payload: {
        dueDate: "2026-07-02",
        fromSectionId: sectionId,
        priority: "HIGH",
        sectionId,
        status: "IN_PROGRESS",
        title: "Updated integration task",
        toSectionId: sectionId,
      },
      projectId,
      taskId,
      workspaceId,
    });

    const completeTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/complete",
    });
    expect(completeTask.statusCode).toBe(200);
    const completeTaskBody = completeTask.json<{ status: string; version: number }>();
    expect(completeTaskBody.status).toBe("DONE");
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskCompleted",
      payload: {
        dueDate: "2026-07-02",
        previousStatus: "IN_PROGRESS",
        priority: "HIGH",
        status: "DONE",
        title: "Updated integration task",
      },
      projectId,
      taskId,
      workspaceId,
    });

    const completedEventCount = await prisma.activityEvent.count({
      where: { eventType: "TaskCompleted", taskId, workspaceId },
    });
    const editCompletedTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: {
        description: "Edited after completion without re-completing.",
        priority: "HIGH",
        status: "DONE",
        title: "Updated completed integration task",
        version: completeTaskBody.version,
      },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId,
    });
    expect(editCompletedTask.statusCode).toBe(200);
    expect(await prisma.activityEvent.count({ where: { eventType: "TaskCompleted", taskId, workspaceId } })).toBe(completedEventCount);
    await expectLatestTaskEvent(workspaceId, taskId, "TaskUpdated");
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskUpdated",
      payload: {
        dueDate: "2026-07-02",
        previousTitle: "Updated integration task",
        priority: "HIGH",
        status: "DONE",
        title: "Updated completed integration task",
      },
      projectId,
      taskId,
      workspaceId,
    });

    const assignTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { userId: currentUser.id },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/assign",
    });
    expect(assignTask.statusCode).toBe(200);

    const assignedTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId,
    });
    expect(assignedTask.statusCode).toBe(200);
    expect(assignedTask.json<{ assignees: Array<{ userId: string }> }>().assignees).toContainEqual(
      expect.objectContaining({ userId: currentUser.id }),
    );

    const myDoneWork = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/my-work?due=any&limit=10&status=done",
    });
    expect(myDoneWork.statusCode).toBe(200);
    expect(
      myDoneWork.json<{ items: Array<{ id: string; project: { id: string; name: string; visibility: string }; status: string }> }>().items,
    ).toContainEqual(
      expect.objectContaining({
        id: taskId,
        project: expect.objectContaining({ id: projectId, name: "Integration Project", visibility: "WORKSPACE" }),
        status: "DONE",
      }),
    );

    const myOpenWork = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/my-work?due=any&limit=10",
    });
    expect(myOpenWork.statusCode).toBe(200);
    expect(myOpenWork.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(expect.objectContaining({ id: taskId }));

    const unassignTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { userId: currentUser.id },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/unassign",
    });
    expect(unassignTask.statusCode).toBe(200);

    const watchTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { userId: currentUser.id },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/watchers",
    });
    expect(watchTask.statusCode).toBe(200);
    expect(watchTask.json<{ user: { id: string }; userId: string }>()).toMatchObject({
      user: { id: currentUser.id },
      userId: currentUser.id,
    });

    const taskWatchers = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/watchers",
    });
    expect(taskWatchers.statusCode).toBe(200);
    expect(taskWatchers.json<{ items: Array<{ userId: string }> }>().items).toContainEqual(
      expect.objectContaining({ userId: currentUser.id }),
    );
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskWatched",
      payload: { title: "Updated completed integration task", userId: currentUser.id },
      projectId,
      taskId,
      workspaceId,
    });

    const unwatchTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/watchers/" + currentUser.id,
    });
    expect(unwatchTask.statusCode).toBe(200);
    const taskWatchersAfterUnwatch = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/watchers",
    });
    expect(taskWatchersAfterUnwatch.statusCode).toBe(200);
    expect(taskWatchersAfterUnwatch.json<{ items: Array<{ userId: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ userId: currentUser.id }),
    );
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskUnwatched",
      payload: { title: "Updated completed integration task", userId: currentUser.id },
      projectId,
      taskId,
      workspaceId,
    });

    const createLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { color: "#22c55e", name: "Client" },
      url: "/api/v1/workspaces/" + workspaceId + "/labels",
    });
    expect(createLabel.statusCode).toBe(201);
    const labelBody = createLabel.json<{ color: string; id: string; name: string; workspaceId: string }>();
    expect(labelBody).toMatchObject({ color: "#22c55e", name: "Client", workspaceId });

    const duplicateLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { color: "#ef4444", name: "Client" },
      url: "/api/v1/workspaces/" + workspaceId + "/labels",
    });
    expect(duplicateLabel.statusCode).toBe(409);

    const updateLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { color: "#0ea5e9", name: "Client Review" },
      url: "/api/v1/workspaces/" + workspaceId + "/labels/" + labelBody.id,
    });
    expect(updateLabel.statusCode).toBe(200);
    expect(updateLabel.json<{ color: string; name: string }>()).toMatchObject({ color: "#0ea5e9", name: "Client Review" });

    const workspaceLabels = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/labels",
    });
    expect(workspaceLabels.statusCode).toBe(200);
    expect(workspaceLabels.json<{ items: Array<{ id: string; name: string }> }>().items).toContainEqual(
      expect.objectContaining({ id: labelBody.id, name: "Client Review" }),
    );

    const assignLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/labels/" + labelBody.id,
    });
    expect(assignLabel.statusCode).toBe(200);
    expect(assignLabel.json<{ label: { color: string; name: string }; labelId: string }>()).toMatchObject({
      label: { color: "#0ea5e9", name: "Client Review" },
      labelId: labelBody.id,
    });

    const taskLabels = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/labels",
    });
    expect(taskLabels.statusCode).toBe(200);
    expect(taskLabels.json<{ items: Array<{ labelId: string }> }>().items).toContainEqual(expect.objectContaining({ labelId: labelBody.id }));
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskLabelAdded",
      payload: { color: "#0ea5e9", labelId: labelBody.id, name: "Client Review", title: "Updated completed integration task" },
      projectId,
      taskId,
      workspaceId,
    });

    const unassignLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/labels/" + labelBody.id,
    });
    expect(unassignLabel.statusCode).toBe(200);
    const taskLabelsAfterUnassign = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/labels",
    });
    expect(taskLabelsAfterUnassign.statusCode).toBe(200);
    expect(taskLabelsAfterUnassign.json<{ items: Array<{ labelId: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ labelId: labelBody.id }),
    );
    await expectActivityEvent({
      entityId: taskId,
      entityType: "task",
      eventType: "TaskLabelRemoved",
      payload: { color: "#0ea5e9", labelId: labelBody.id, name: "Client Review", title: "Updated completed integration task" },
      projectId,
      taskId,
      workspaceId,
    });

    const deleteLabel = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/labels/" + labelBody.id,
    });
    expect(deleteLabel.statusCode).toBe(200);

    const createSubtask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { title: "Detail panel subtask" },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/subtasks",
    });
    expect(createSubtask.statusCode).toBe(201);
    const subtaskBody = createSubtask.json<{ id: string; version: number }>();

    const updateSubtask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { status: "DONE", version: subtaskBody.version },
      url: "/api/v1/workspaces/" + workspaceId + "/subtasks/" + subtaskBody.id,
    });
    expect(updateSubtask.statusCode).toBe(200);
    expect(updateSubtask.json<{ status: string }>().status).toBe("DONE");
    await expectActivityEvent({
      entityId: subtaskBody.id,
      entityType: "subtask",
      eventType: "SubtaskUpdated",
      payload: { status: "DONE", title: "Detail panel subtask" },
      projectId,
      taskId,
      workspaceId,
    });

    const deleteSubtask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/subtasks/" + subtaskBody.id,
    });
    expect(deleteSubtask.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: subtaskBody.id,
      entityType: "subtask",
      eventType: "SubtaskDeleted",
      payload: { status: "DONE", title: "Detail panel subtask" },
      projectId,
      taskId,
      workspaceId,
    });

    const subtasksAfterDelete = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/subtasks",
    });
    expect(subtasksAfterDelete.statusCode).toBe(200);
    expect(subtasksAfterDelete.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ id: subtaskBody.id }),
    );

    const detailComment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { body: "Detail comment" },
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/comments",
    });
    expect(detailComment.statusCode).toBe(201);
    const detailCommentBody = detailComment.json<{ id: string }>();

    const updateComment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { body: "Edited detail comment" },
      url: "/api/v1/workspaces/" + workspaceId + "/comments/" + detailCommentBody.id,
    });
    expect(updateComment.statusCode).toBe(200);
    expect(updateComment.json<{ body: string; editedAt: string | null }>()).toMatchObject({ body: "Edited detail comment" });
    await expectActivityEvent({
      entityId: detailCommentBody.id,
      entityType: "comment",
      eventType: "CommentUpdated",
      projectId,
      taskId,
      workspaceId,
    });

    const deleteComment = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/comments/" + detailCommentBody.id,
    });
    expect(deleteComment.statusCode).toBe(200);
    await expectActivityEvent({
      entityId: detailCommentBody.id,
      entityType: "comment",
      eventType: "CommentDeleted",
      projectId,
      taskId,
      workspaceId,
    });

    const commentsAfterDelete = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + taskId + "/comments",
    });
    expect(commentsAfterDelete.statusCode).toBe(200);
    expect(commentsAfterDelete.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(
      expect.objectContaining({ id: detailCommentBody.id }),
    );
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

  it("lists and marks notifications read", async () => {
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { email } });
    const unread = await prisma.notification.create({
      data: {
        body: "A task needs your attention.",
        recipientId: currentUser.id,
        taskId,
        title: "Task updated",
        type: "task.updated",
        workspaceId,
      },
    });

    const unreadList = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/notifications?unreadOnly=true",
    });
    expect(unreadList.statusCode).toBe(200);
    expect(unreadList.json<{ items: Array<{ id: string; status: string; taskId: string | null }> }>().items).toContainEqual(
      expect.objectContaining({ id: unread.id, status: "UNREAD", taskId }),
    );

    const markRead = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/notifications/" + unread.id + "/read",
    });
    expect(markRead.statusCode).toBe(200);

    const read = await prisma.notification.findUniqueOrThrow({ where: { id: unread.id } });
    expect(read.status).toBe("READ");
    expect(read.readAt).toBeInstanceOf(Date);

    const secondUnread = await prisma.notification.create({
      data: {
        body: "Another task needs your attention.",
        recipientId: currentUser.id,
        taskId,
        title: "Another task updated",
        type: "task.updated",
        workspaceId,
      },
    });

    const markAllRead = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/notifications/read-all",
    });
    expect(markAllRead.statusCode).toBe(200);

    const remainingUnread = await prisma.notification.count({
      where: { recipientId: currentUser.id, status: "UNREAD", workspaceId },
    });
    expect(remainingUnread).toBe(0);

    const allList = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/notifications?limit=50",
    });
    expect(allList.statusCode).toBe(200);
    expect(allList.json<{ items: Array<{ id: string; status: string }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: unread.id, status: "READ" }),
        expect.objectContaining({ id: secondUnread.id, status: "READ" }),
      ]),
    );
  });

  it("persists workspace notification email preferences", async () => {
    const currentUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    const defaults = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/notification-preferences",
    });
    expect(defaults.statusCode).toBe(200);
    expect(defaults.json()).toMatchObject({
      emailEnabled: false,
      inAppEnabled: true,
      updatedAt: null,
      userId: currentUser.id,
      workspaceId,
    });

    const enabled = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { emailEnabled: true },
      url: "/api/v1/workspaces/" + workspaceId + "/notification-preferences",
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json<{ emailEnabled: boolean; updatedAt: string | null }>()).toMatchObject({
      emailEnabled: true,
      updatedAt: expect.any(String),
    });

    await expect(
      prisma.workspaceNotificationPreference.findUniqueOrThrow({
        where: { workspaceId_userId: { userId: currentUser.id, workspaceId } },
      }),
    ).resolves.toMatchObject({ emailEnabled: true });

    const disabled = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { emailEnabled: false },
      url: "/api/v1/workspaces/" + workspaceId + "/notification-preferences",
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json<{ emailEnabled: boolean }>().emailEnabled).toBe(false);
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
    const firstInviteBody = firstInvite.json<{
      acceptToken: string;
      emailDelivery: { provider: string; recipientCount: number; status: string };
      id: string;
    }>();
    expect(firstInviteBody.emailDelivery).toEqual({ provider: "noop", recipientCount: 1, status: "stubbed" });

    const listInvitations = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(listInvitations.statusCode).toBe(200);
    expect(listInvitations.json<{ items: unknown[] }>().items).toHaveLength(1);

    const canceledEmail = "atlas-lifecycle-cancel-" + randomUUID() + "@example.com";
    const canceledInvite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { email: canceledEmail, role: "MEMBER" },
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(canceledInvite.statusCode).toBe(201);

    const cancelInvite = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url:
        "/api/v1/workspaces/" +
        lifecycleWorkspaceId +
        "/invitations/" +
        canceledInvite.json<{ id: string }>().id +
        "/cancel",
    });
    expect(cancelInvite.statusCode).toBe(200);

    const afterCancelInvitations = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations",
    });
    expect(afterCancelInvitations.statusCode).toBe(200);
    expect(afterCancelInvitations.json<{ items: Array<{ email: string }> }>().items.some((item) => item.email === canceledEmail)).toBe(false);

    const resend = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + lifecycleWorkspaceId + "/invitations/" + firstInviteBody.id + "/resend",
    });
    expect(resend.statusCode).toBe(200);
    const resendBody = resend.json<{ acceptToken: string; emailDelivery: { provider: string; recipientCount: number; status: string } }>();
    const resentToken = resendBody.acceptToken;
    expect(resendBody.emailDelivery).toEqual({ provider: "noop", recipientCount: 1, status: "stubbed" });

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
    const privateTaskId = privateTask.json<{ id: string }>().id;

    const secondPrivateTask = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { sectionId: privateSection.json<{ id: string }>().id, title: secretTitle + " follow-up" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/tasks",
    });
    expect(secondPrivateTask.statusCode).toBe(201);
    const secondPrivateTaskId = secondPrivateTask.json<{ id: string }>().id;

    const invalidSearchType = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent(secretTitle) + "&type=comment",
    });
    expect(invalidSearchType.statusCode).toBe(400);

    const ownerTaskSearch = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent(secretTitle) + "&type=task",
    });
    expect(ownerTaskSearch.statusCode).toBe(200);
    expect(ownerTaskSearch.json<{ items: Array<{ task: { id: string; projectId: string; title: string }; type: string }> }>().items).toContainEqual(
      expect.objectContaining({
        task: expect.objectContaining({ id: privateTaskId, projectId: privateProjectId, title: secretTitle }),
        type: "task",
      }),
    );
    expect(ownerTaskSearch.json<{ pageInfo: { hasNextPage: boolean; nextCursor: string | null } }>().pageInfo).toEqual({
      hasNextPage: false,
      nextCursor: null,
    });

    const firstTaskSearchPage = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent(secretTitle) + "&type=task&limit=1",
    });
    expect(firstTaskSearchPage.statusCode).toBe(200);
    const firstTaskSearchPageBody = firstTaskSearchPage.json<{
      items: Array<{ task: { id: string }; type: "task" }>;
      pageInfo: { hasNextPage: boolean; nextCursor: string | null };
    }>();
    expect(firstTaskSearchPageBody.items).toHaveLength(1);
    expect(firstTaskSearchPageBody.pageInfo.hasNextPage).toBe(true);
    expect(typeof firstTaskSearchPageBody.pageInfo.nextCursor).toBe("string");

    const secondTaskSearchPage = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url:
        "/api/v1/workspaces/" +
        workspaceId +
        "/search?q=" +
        encodeURIComponent(secretTitle) +
        "&type=task&limit=1&cursor=" +
        encodeURIComponent(firstTaskSearchPageBody.pageInfo.nextCursor ?? ""),
    });
    expect(secondTaskSearchPage.statusCode).toBe(200);
    const secondTaskSearchPageBody = secondTaskSearchPage.json<{
      items: Array<{ task: { id: string }; type: "task" }>;
      pageInfo: { hasNextPage: boolean; nextCursor: string | null };
    }>();
    expect(secondTaskSearchPageBody.items).toHaveLength(1);
    expect(secondTaskSearchPageBody.items[0]?.task.id).not.toBe(firstTaskSearchPageBody.items[0]?.task.id);
    expect([firstTaskSearchPageBody.items[0]?.task.id, secondTaskSearchPageBody.items[0]?.task.id].sort()).toEqual(
      [privateTaskId, secondPrivateTaskId].sort(),
    );
    expect(secondTaskSearchPageBody.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });

    const ownerProjectSearch = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent("Private Integration Project") + "&type=project",
    });
    expect(ownerProjectSearch.statusCode).toBe(200);
    expect(ownerProjectSearch.json<{ items: Array<{ project: { id: string; name: string }; type: string }> }>().items).toContainEqual(
      expect.objectContaining({
        project: expect.objectContaining({ id: privateProjectId, name: "Private Integration Project" }),
        type: "project",
      }),
    );

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

    const memberUser = await prisma.user.findUniqueOrThrow({ where: { email: memberEmail } });
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    const projectMembersBefore = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members",
    });
    expect(projectMembersBefore.statusCode).toBe(200);
    expect(projectMembersBefore.json<{ items: Array<{ role: string; userId: string }> }>().items).toContainEqual(
      expect.objectContaining({ role: "PROJECT_ADMIN", userId: ownerUser.id }),
    );

    const removeLastProjectAdmin = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members/" + ownerUser.id,
    });
    expect(removeLastProjectAdmin.statusCode).toBe(403);

    const addProjectMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { role: "VIEWER", userId: memberUser.id },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members",
    });
    expect(addProjectMember.statusCode).toBe(201);
    expect(addProjectMember.json<{ role: string; userId: string }>()).toMatchObject({ role: "VIEWER", userId: memberUser.id });
    await expectProjectMemberLifecycleEvent(workspaceId, "ProjectMemberAdded", privateProjectId, memberUser.id, { role: "VIEWER" });

    const duplicateProjectMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      payload: { role: "EDITOR", userId: memberUser.id },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members",
    });
    expect(duplicateProjectMember.statusCode).toBe(409);

    const memberPrivateProjectAfterAdd = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId,
    });
    expect(memberPrivateProjectAfterAdd.statusCode).toBe(200);

    const memberPrivateSearchAfterAdd = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/search?q=" + encodeURIComponent(secretTitle),
    });
    expect(memberPrivateSearchAfterAdd.statusCode).toBe(200);
    expect(memberPrivateSearchAfterAdd.json<{ items: Array<{ task: { id: string }; type: string }> }>().items).toContainEqual(
      expect.objectContaining({ task: expect.objectContaining({ id: privateTaskId }), type: "task" }),
    );

    const updateProjectMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "PATCH",
      payload: { role: "COMMENTER" },
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members/" + memberUser.id,
    });
    expect(updateProjectMember.statusCode).toBe(200);
    expect(updateProjectMember.json<{ role: string; userId: string }>()).toMatchObject({ role: "COMMENTER", userId: memberUser.id });
    await expectProjectMemberLifecycleEvent(workspaceId, "ProjectMemberUpdated", privateProjectId, memberUser.id, {
      previousRole: "VIEWER",
      role: "COMMENTER",
    });

    const removeProjectMember = await app!.inject({
      headers: authHeaders(accessToken),
      method: "DELETE",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/members/" + memberUser.id,
    });
    expect(removeProjectMember.statusCode).toBe(200);
    await expectProjectMemberLifecycleEvent(workspaceId, "ProjectMemberRemoved", privateProjectId, memberUser.id, { role: "COMMENTER" });

    const memberPrivateProjectAfterRemove = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId,
    });
    expect(memberPrivateProjectAfterRemove.statusCode).toBe(403);

    const ownerPrivateActivity = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/projects/" + privateProjectId + "/activity",
    });
    expect(ownerPrivateActivity.statusCode).toBe(200);
    expect(ownerPrivateActivity.json<{ items: Array<{ eventType: string; projectId: string | null; taskId: string | null }> }>().items).toContainEqual(
      expect.objectContaining({ eventType: "TaskCreated", projectId: privateProjectId, taskId: privateTaskId }),
    );

    const ownerTaskActivity = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/tasks/" + privateTaskId + "/activity",
    });
    expect(ownerTaskActivity.statusCode).toBe(200);
    expect(ownerTaskActivity.json<{ items: Array<{ eventType: string; projectId: string | null; taskId: string | null }> }>().items).toContainEqual(
      expect.objectContaining({ eventType: "TaskCreated", projectId: privateProjectId, taskId: privateTaskId }),
    );
  }, 60_000);

  it("records outbox dispatch attempt history", async () => {
    const successEventId = randomUUID();
    const success = await prisma.domainEventOutbox.create({
      data: {
        eventId: successEventId,
        eventType: "TaskUpdated",
        payload: {
          actorUserId: "00000000-0000-0000-0000-000000000001",
          entityId: taskId,
          entityType: "task",
          eventId: successEventId,
          eventType: "TaskUpdated",
          projectId,
          taskId,
          workspaceId,
        },
      },
    });

    await dispatchOutboxEvent!(success, async () => undefined);

    const processed = await prisma.domainEventOutbox.findUniqueOrThrow({
      include: { attemptsLog: { orderBy: { attemptNumber: "asc" } } },
      where: { id: success.id },
    });
    expect(processed.processedAt).toBeInstanceOf(Date);
    expect(processed.attemptsLog).toHaveLength(1);
    expect(processed.attemptsLog[0]).toMatchObject({ attemptNumber: 1, error: null, status: "succeeded" });

    const failedEventId = randomUUID();
    const failed = await prisma.domainEventOutbox.create({
      data: {
        eventId: failedEventId,
        eventType: "TaskUpdated",
        payload: {
          actorUserId: "00000000-0000-0000-0000-000000000001",
          entityId: taskId,
          entityType: "task",
          eventId: failedEventId,
          eventType: "TaskUpdated",
          projectId,
          taskId,
          workspaceId,
        },
      },
    });

    await dispatchOutboxEvent!(failed, async () => {
      throw new Error("Queue unavailable");
    });

    const failedAttempt = await prisma.domainEventOutbox.findUniqueOrThrow({
      include: { attemptsLog: { orderBy: { attemptNumber: "asc" } } },
      where: { id: failed.id },
    });
    expect(failedAttempt.attempts).toBe(1);
    expect(failedAttempt.failedAt).toBeNull();
    expect(failedAttempt.lastError).toBe("Queue unavailable");
    expect(failedAttempt.nextAttemptAt).toBeInstanceOf(Date);
    expect(failedAttempt.attemptsLog).toHaveLength(1);
    expect(failedAttempt.attemptsLog[0]).toMatchObject({ attemptNumber: 1, error: "Queue unavailable", status: "failed" });
  });

  it("lets workspace admins inspect and replay failed outbox events", async () => {
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const failed = await prisma.domainEventOutbox.create({
      data: {
        attempts: 10,
        eventId,
        eventType: "TaskUpdated",
        failedAt: new Date(),
        lastError: "Queue unavailable",
        payload: {
          actorUserId: "00000000-0000-0000-0000-000000000001",
          entityId: taskId,
          entityType: "task",
          eventId,
          eventType: "TaskUpdated",
          projectId,
          occurredAt,
          payload: { source: "integration-test" },
          taskId,
          version: 3,
          workspaceId,
        },
      },
    });

    const failedAttemptStartedAt = new Date(Date.now() - 1000);
    await prisma.domainEventOutboxAttempt.create({
      data: {
        attemptNumber: 10,
        error: "Queue unavailable",
        finishedAt: new Date(),
        outboxEventId: failed.id,
        startedAt: failedAttemptStartedAt,
        status: "failed",
      },
    });
    await prisma.workerJobOutcome.create({
      data: {
        entityId: taskId,
        entityType: "task",
        eventId,
        eventType: "TaskUpdated",
        jobId: "email-job-1",
        provider: "noop",
        queue: "atlas-email-stub",
        reason: "Email provider is configured for no-op delivery.",
        recipientCount: 1,
        status: "stubbed",
        workspaceId,
      },
    });

    const memberList = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/outbox?status=failed",
    });
    expect(memberList.statusCode).toBe(403);

    const memberDetail = await app!.inject({
      headers: authHeaders(memberAccessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/outbox/" + failed.id,
    });
    expect(memberDetail.statusCode).toBe(403);

    const list = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/outbox?status=failed",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ items: Array<{ canReplay: boolean; deadLettered: boolean; id: string; lastError: string | null; status: string }> }>().items).toContainEqual(
      expect.objectContaining({ canReplay: true, deadLettered: true, id: failed.id, lastError: "Queue unavailable", status: "failed" }),
    );

    const detail = await app!.inject({
      headers: authHeaders(accessToken),
      method: "GET",
      url: "/api/v1/workspaces/" + workspaceId + "/outbox/" + failed.id,
    });
    expect(detail.statusCode).toBe(200);
    expect(
      detail.json<{
        attemptHistory: Array<{ attemptNumber: number; error: string | null; status: string }>;
        canReplay: boolean;
        context: {
          entityId: string | null;
          entityType: string | null;
          occurredAt: string | null;
          projectId: string | null;
          taskId: string | null;
          version: number | null;
        };
        deadLettered: boolean;
        id: string;
        payload: { payload?: { source?: string }; taskId?: string; workspaceId?: string };
        workerOutcomes: Array<{ jobId: string | null; provider: string | null; queue: string; recipientCount: number | null; status: string }>;
      }>(),
    ).toMatchObject({
      attemptHistory: [expect.objectContaining({ attemptNumber: 10, error: "Queue unavailable", status: "failed" })],
      canReplay: true,
      context: {
        entityId: taskId,
        entityType: "task",
        occurredAt,
        projectId,
        taskId,
        version: 3,
      },
      deadLettered: true,
      id: failed.id,
      payload: {
        payload: { source: "integration-test" },
        taskId,
        workspaceId,
      },
      workerOutcomes: [
        expect.objectContaining({
          jobId: "email-job-1",
          provider: "noop",
          queue: "atlas-email-stub",
          recipientCount: 1,
          status: "stubbed",
        }),
      ],
    });

    const replay = await app!.inject({
      headers: authHeaders(accessToken),
      method: "POST",
      url: "/api/v1/workspaces/" + workspaceId + "/outbox/" + failed.id + "/replay",
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json<{ event: { attempts: number; canReplay: boolean; deadLettered: boolean; failedAt: string | null; status: string }; replayQueued: boolean }>()).toMatchObject({
      event: { attempts: 0, canReplay: false, deadLettered: false, failedAt: null, status: "pending" },
      replayQueued: true,
    });

    const replayed = await prisma.domainEventOutbox.findUniqueOrThrow({
      include: { attemptsLog: { orderBy: { attemptNumber: "desc" } } },
      where: { id: failed.id },
    });
    expect(replayed.attempts).toBe(0);
    expect(replayed.failedAt).toBeNull();
    expect(replayed.lastError).toBeNull();
    expect(replayed.nextAttemptAt).toBeInstanceOf(Date);
    expect(replayed.attemptsLog).toHaveLength(1);
    expect(replayed.attemptsLog[0]).toMatchObject({ attemptNumber: 10, status: "failed" });
  });
});

function authHeaders(accessToken: string) {
  return { authorization: "Bearer " + accessToken };
}

async function expectProjectLifecycleEvent(workspaceId: string, eventType: string, projectId: string, payload: { name: string; visibility: string }) {
  const activity = await prisma.activityEvent.findFirst({
    orderBy: { createdAt: "desc" },
    where: { entityId: projectId, entityType: "project", eventType, projectId, workspaceId },
  });
  expect(activity).toMatchObject({
    actorUserId: expect.any(String),
    entityId: projectId,
    entityType: "project",
    eventType,
    projectId,
    taskId: null,
    workspaceId,
  });

  const outbox = await prisma.domainEventOutbox.findUnique({ where: { eventId: activity!.id } });
  expect(outbox).toMatchObject({ eventType });
  expect(outbox?.payload).toMatchObject({
    entityId: projectId,
    entityType: "project",
    eventId: activity!.id,
    eventType,
    occurredAt: expect.any(String),
    payload: expect.objectContaining(payload),
    projectId,
    taskId: null,
    version: 0,
    workspaceId,
  });
}

async function expectLatestTaskEvent(workspaceId: string, taskId: string, eventType: string) {
  const activity = await prisma.activityEvent.findFirst({
    orderBy: { createdAt: "desc" },
    where: { taskId, workspaceId },
  });
  expect(activity).toMatchObject({
    entityType: "task",
    eventType,
    taskId,
    workspaceId,
  });
}

async function expectActivityEvent(input: {
  entityId: string;
  entityType: string;
  eventType: string;
  payload?: Record<string, unknown>;
  projectId?: string | null;
  taskId?: string | null;
  workspaceId: string;
}) {
  const activity = await prisma.activityEvent.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.eventType,
      workspaceId: input.workspaceId,
    },
  });
  expect(activity).toMatchObject({
    actorUserId: expect.any(String),
    entityId: input.entityId,
    entityType: input.entityType,
    eventType: input.eventType,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    workspaceId: input.workspaceId,
  });

  const outbox = await prisma.domainEventOutbox.findUnique({ where: { eventId: activity!.id } });
  expect(outbox).toMatchObject({ eventType: input.eventType });
  expect(outbox?.payload).toMatchObject({
    entityId: input.entityId,
    entityType: input.entityType,
    eventId: activity!.id,
    eventType: input.eventType,
    occurredAt: expect.any(String),
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    workspaceId: input.workspaceId,
  });
  if (input.payload) {
    expect(outbox?.payload).toMatchObject({ payload: expect.objectContaining(input.payload) });
  }
}

async function expectProjectMemberLifecycleEvent(
  workspaceId: string,
  eventType: string,
  projectId: string,
  userId: string,
  payload: Record<string, unknown>,
) {
  const activity = await prisma.activityEvent.findFirst({
    orderBy: { createdAt: "desc" },
    where: { entityType: "project_member", eventType, projectId, workspaceId },
  });
  expect(activity).toMatchObject({
    actorUserId: expect.any(String),
    entityType: "project_member",
    eventType,
    projectId,
    taskId: null,
    workspaceId,
  });

  const outbox = await prisma.domainEventOutbox.findUnique({ where: { eventId: activity!.id } });
  expect(outbox).toMatchObject({ eventType });
  expect(outbox?.payload).toMatchObject({
    entityId: activity!.entityId,
    entityType: "project_member",
    eventId: activity!.id,
    eventType,
    occurredAt: expect.any(String),
    payload: expect.objectContaining({ userId, ...payload }),
    projectId,
    taskId: null,
    version: 0,
    workspaceId,
  });
}
