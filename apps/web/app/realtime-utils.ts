import type { ActivityEvent } from "./atlas-types";

export type RealtimeSubscriptionScope = "project" | "task" | "workspace";
export type RealtimeStatus = "connected" | "connecting" | "error" | "offline" | "reconnecting";

export type RealtimeSubscription = {
  action: "subscribe";
  id: string;
  scope: RealtimeSubscriptionScope;
};

export type RealtimeDomainEvent = {
  event: ActivityEvent;
  eventId: string;
  eventType: string;
  projectId: string | null;
  taskId: string | null;
  type: string;
};

export type RealtimeMessage =
  | { kind: "domain-event"; event: RealtimeDomainEvent }
  | { kind: "error"; code?: string; message: string }
  | { kind: "subscribed"; subscription: RealtimeSubscription }
  | { kind: "unknown" };

const projectRefreshEvents = new Set([
  "SectionCreated",
  "SectionsReordered",
  "TaskAssigned",
  "TaskCompleted",
  "TaskCreated",
  "TaskMoved",
  "TaskUnassigned",
  "TaskUpdated",
]);

const projectMemberRefreshEvents = new Set(["ProjectMemberAdded", "ProjectMemberRemoved", "ProjectMemberUpdated"]);

const projectListRefreshEvents = new Set([
  "ProjectArchived",
  "ProjectCreated",
  "ProjectDeleted",
  "ProjectMemberAdded",
  "ProjectMemberRemoved",
  "ProjectMemberUpdated",
  "ProjectUpdated",
]);

export function parseRealtimeMessage(raw: string): RealtimeMessage {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    return { kind: "unknown" };
  }

  if (!isRecord(data)) return { kind: "unknown" };

  const error = data.error;
  if (isRecord(error)) {
    return {
      code: typeof error.code === "string" ? error.code : undefined,
      kind: "error",
      message: typeof error.message === "string" ? error.message : "Realtime error.",
    };
  }

  if (data.ok === true && isRecord(data.subscribed)) {
    const subscription = parseSubscription(data.subscribed);
    return subscription ? { kind: "subscribed", subscription } : { kind: "unknown" };
  }

  if (typeof data.type === "string" && isRecord(data.event) && typeof data.event.id === "string") {
    const eventType = typeof data.event.eventType === "string" ? data.event.eventType : data.type;
    return {
      event: {
        event: data.event as ActivityEvent,
        eventId: data.event.id,
        eventType,
        projectId: stringOrNull(data.event.projectId),
        taskId: stringOrNull(data.event.taskId),
        type: data.type,
      },
      kind: "domain-event",
    };
  }

  return { kind: "unknown" };
}

export function realtimeSubscriptions(input: { projectId: string; taskId: string; workspaceId: string }) {
  const subscriptions: RealtimeSubscription[] = [];
  if (input.workspaceId) subscriptions.push({ action: "subscribe", id: input.workspaceId, scope: "workspace" });
  if (input.projectId) subscriptions.push({ action: "subscribe", id: input.projectId, scope: "project" });
  if (input.taskId) subscriptions.push({ action: "subscribe", id: input.taskId, scope: "task" });
  return subscriptions;
}

export function rememberRealtimeEvent(eventId: string, recentEventIds: string[], maxEventIds = 50) {
  if (recentEventIds.includes(eventId)) return false;
  recentEventIds.unshift(eventId);
  if (recentEventIds.length > maxEventIds) recentEventIds.length = maxEventIds;
  return true;
}

export function realtimeReconnectDelay(attempt: number) {
  return Math.min(500 * 2 ** attempt, 10_000);
}

export function realtimeEventTouchesProject(event: RealtimeDomainEvent, selectedProjectId: string) {
  return Boolean(selectedProjectId && event.projectId === selectedProjectId && projectRefreshEvents.has(event.eventType));
}

export function realtimeEventTouchesProjectList(event: RealtimeDomainEvent) {
  return projectListRefreshEvents.has(event.eventType);
}

export function realtimeEventTouchesProjectMembers(event: RealtimeDomainEvent, selectedProjectId: string) {
  return Boolean(selectedProjectId && event.projectId === selectedProjectId && projectMemberRefreshEvents.has(event.eventType));
}

export function realtimeEventTouchesTask(event: RealtimeDomainEvent, selectedTaskId: string) {
  return Boolean(selectedTaskId && event.taskId === selectedTaskId);
}

function parseSubscription(value: Record<string, unknown>): RealtimeSubscription | null {
  if (value.action !== "subscribe" || typeof value.id !== "string" || !isRealtimeScope(value.scope)) return null;
  return { action: "subscribe", id: value.id, scope: value.scope };
}

function isRealtimeScope(value: unknown): value is RealtimeSubscriptionScope {
  return value === "project" || value === "task" || value === "workspace";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}
