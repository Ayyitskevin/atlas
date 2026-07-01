import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { taskNotificationCopy } from "../../src/jobs/notification-copy.js";

describe("taskNotificationCopy", () => {
  it("formats common task and collaboration events for people", () => {
    expect(taskNotificationCopy(event("TaskCompleted"), "Launch checklist")).toEqual({
      body: "\"Launch checklist\" was marked complete.",
      title: "Task completed",
    });
    expect(taskNotificationCopy(event("CommentCreated"), "Launch checklist")).toEqual({
      body: "A comment was added to \"Launch checklist\".",
      title: "New comment",
    });
    expect(taskNotificationCopy(event("AttachmentDeleted"), "Launch checklist")).toEqual({
      body: "A file was removed from \"Launch checklist\".",
      title: "Attachment removed",
    });
  });

  it("falls back to generic task activity copy for unknown event types", () => {
    expect(taskNotificationCopy(event("CustomEvent"), "")).toEqual({
      body: "There is new activity on \"Untitled task\".",
      title: "Task activity",
    });
  });
});

function event(eventType: string) {
  return {
    actorUserId: randomUUID(),
    entityId: randomUUID(),
    entityType: "task",
    eventId: randomUUID(),
    eventType,
    taskId: randomUUID(),
    workspaceId: randomUUID(),
  };
}
