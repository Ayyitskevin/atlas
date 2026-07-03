import { describe, expect, it } from "vitest";

import {
  parseRealtimeMessage,
  realtimeEventTouchesProject,
  realtimeEventTouchesProjectList,
  realtimeEventTouchesProjectMembers,
  realtimeEventTouchesTask,
  realtimeReconnectDelay,
  realtimeSubscriptions,
  rememberRealtimeEvent,
  type RealtimeDomainEvent,
} from "./realtime-utils";

describe("realtime utilities", () => {
  it("parses subscribe acknowledgements", () => {
    expect(
      parseRealtimeMessage(JSON.stringify({ ok: true, subscribed: { action: "subscribe", id: "workspace-1", scope: "workspace" } })),
    ).toEqual({
      kind: "subscribed",
      subscription: { action: "subscribe", id: "workspace-1", scope: "workspace" },
    });
  });

  it("parses realtime domain events", () => {
    const message = parseRealtimeMessage(
      JSON.stringify({
        event: {
          actorUserId: "user-1",
          createdAt: "2026-06-29T00:00:00.000Z",
          entityId: "task-1",
          entityType: "task",
          eventType: "TaskUpdated",
          id: "event-1",
          projectId: "project-1",
          taskId: "task-1",
        },
        type: "TaskUpdated",
      }),
    );

    expect(message).toMatchObject({
      event: { eventId: "event-1", eventType: "TaskUpdated", projectId: "project-1", taskId: "task-1", type: "TaskUpdated" },
      kind: "domain-event",
    });
  });

  it("parses server errors and ignores malformed messages", () => {
    expect(parseRealtimeMessage(JSON.stringify({ error: { code: "ATLAS_BAD_REQUEST", message: "Invalid scope." } }))).toEqual({
      code: "ATLAS_BAD_REQUEST",
      kind: "error",
      message: "Invalid scope.",
    });
    expect(parseRealtimeMessage("not json")).toEqual({ kind: "unknown" });
    expect(parseRealtimeMessage(JSON.stringify({ ok: true, subscribed: { id: "missing-action", scope: "workspace" } }))).toEqual({
      kind: "unknown",
    });
  });

  it("builds workspace, project, and task subscriptions", () => {
    expect(realtimeSubscriptions({ projectId: "project-1", taskId: "task-1", workspaceId: "workspace-1" })).toEqual([
      { action: "subscribe", id: "workspace-1", scope: "workspace" },
      { action: "subscribe", id: "project-1", scope: "project" },
      { action: "subscribe", id: "task-1", scope: "task" },
    ]);
  });

  it("deduplicates recently seen events", () => {
    const recentEventIds: string[] = [];
    expect(rememberRealtimeEvent("event-1", recentEventIds, 2)).toBe(true);
    expect(rememberRealtimeEvent("event-1", recentEventIds, 2)).toBe(false);
    expect(rememberRealtimeEvent("event-2", recentEventIds, 2)).toBe(true);
    expect(rememberRealtimeEvent("event-3", recentEventIds, 2)).toBe(true);
    expect(recentEventIds).toEqual(["event-3", "event-2"]);
  });

  it("caps reconnect backoff", () => {
    expect(realtimeReconnectDelay(0)).toBe(500);
    expect(realtimeReconnectDelay(3)).toBe(4000);
    expect(realtimeReconnectDelay(10)).toBe(10000);
  });

  it("classifies which selected data a domain event touches", () => {
    const taskEvent = { eventType: "TaskMoved", projectId: "project-1", taskId: "task-1" } as RealtimeDomainEvent;
    const labelEvent = { eventType: "TaskLabelAdded", projectId: "project-1", taskId: "task-1" } as RealtimeDomainEvent;
    const commentEvent = { eventType: "CommentCreated", projectId: "project-1", taskId: "task-1" } as RealtimeDomainEvent;

    expect(realtimeEventTouchesProject(taskEvent, "project-1")).toBe(true);
    expect(realtimeEventTouchesProject(labelEvent, "project-1")).toBe(true);
    expect(realtimeEventTouchesProject(commentEvent, "project-1")).toBe(false);
    expect(realtimeEventTouchesProject({ eventType: "SectionUpdated", projectId: "project-1", taskId: null } as RealtimeDomainEvent, "project-1")).toBe(true);
    expect(realtimeEventTouchesProjectList({ eventType: "ProjectUpdated", projectId: "project-1", taskId: null } as RealtimeDomainEvent)).toBe(true);
    expect(realtimeEventTouchesProjectList({ eventType: "ProjectMemberAdded", projectId: "project-1", taskId: null } as RealtimeDomainEvent)).toBe(true);
    expect(realtimeEventTouchesProjectList(taskEvent)).toBe(false);
    expect(realtimeEventTouchesProjectMembers({ eventType: "ProjectMemberUpdated", projectId: "project-1", taskId: null } as RealtimeDomainEvent, "project-1")).toBe(true);
    expect(realtimeEventTouchesProjectMembers({ eventType: "ProjectMemberUpdated", projectId: "project-2", taskId: null } as RealtimeDomainEvent, "project-1")).toBe(false);
    expect(realtimeEventTouchesTask(commentEvent, "task-1")).toBe(true);
    expect(realtimeEventTouchesTask(commentEvent, "task-2")).toBe(false);
  });
});
