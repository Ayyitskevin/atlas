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
    expect(taskNotificationCopy(event("TaskLabelAdded"), "Launch checklist")).toEqual({
      body: "A label was added to \"Launch checklist\".",
      title: "Label added",
    });
    expect(taskNotificationCopy(event("TaskWatched"), "Launch checklist")).toEqual({
      body: "A follower was added to \"Launch checklist\".",
      title: "Follower added",
    });
    expect(taskNotificationCopy(event("TaskRecurrenceSkipped"), "Launch checklist")).toEqual({
      body: "\"Launch checklist\" was skipped and advanced to the next occurrence.",
      title: "Recurring task skipped",
    });
    expect(taskNotificationCopy(event("TaskDependencyAdded", { blockingTaskTitle: "Design draft" }), "Client review")).toEqual({
      body: "\"Client review\" is now blocked by \"Design draft\".",
      title: "Dependency added",
    });
    expect(taskNotificationCopy(event("TaskDependencyRemoved", { blockingTaskTitle: "Design draft" }), "Client review")).toEqual({
      body: "\"Client review\" is no longer blocked by \"Design draft\".",
      title: "Dependency removed",
    });
    expect(taskNotificationCopy(event("TaskDependencyUnblocked", { blockingTaskTitle: "Design draft" }), "Client review")).toEqual({
      body: "\"Client review\" is unblocked because \"Design draft\" was completed.",
      title: "Task unblocked",
    });
  });

  it("falls back to generic task activity copy for unknown event types", () => {
    expect(taskNotificationCopy(event("CustomEvent"), "")).toEqual({
      body: "There is new activity on \"Untitled task\".",
      title: "Task activity",
    });
  });
});

function event(eventType: string, payload: Record<string, unknown> = {}) {
  return {
    actorUserId: randomUUID(),
    entityId: randomUUID(),
    entityType: "task",
    eventId: randomUUID(),
    eventType,
    payload,
    taskId: randomUUID(),
    workspaceId: randomUUID(),
  };
}
