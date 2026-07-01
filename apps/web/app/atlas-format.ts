export function formatEventType(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

const activityTitles: Record<string, string> = {
  AttachmentAdded: "Attachment added",
  AttachmentDeleted: "Attachment removed",
  CommentCreated: "Comment added",
  CommentDeleted: "Comment deleted",
  CommentUpdated: "Comment edited",
  MemberInvited: "Member invited",
  ProjectArchived: "Project archived",
  ProjectCreated: "Project created",
  ProjectDeleted: "Project deleted",
  ProjectMemberAdded: "Project member added",
  ProjectMemberRemoved: "Project member removed",
  ProjectMemberUpdated: "Project member updated",
  ProjectUpdated: "Project updated",
  SectionCreated: "Section created",
  SectionDeleted: "Section removed",
  SectionUpdated: "Section renamed",
  SectionsReordered: "Sections reordered",
  SubtaskCreated: "Subtask added",
  SubtaskDeleted: "Subtask removed",
  SubtaskUpdated: "Subtask updated",
  TaskAssigned: "Task assigned",
  TaskCompleted: "Task completed",
  TaskCreated: "Task created",
  TaskMoved: "Task moved",
  TaskUnassigned: "Task unassigned",
  TaskUpdated: "Task updated",
  WorkspaceCreated: "Workspace created",
};

type ActivitySummaryInput = {
  entityType: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  projectId?: string | null;
  taskId?: string | null;
};

export function formatActivityTitle(eventType: string) {
  return activityTitles[eventType] ?? formatEventType(eventType);
}

export function formatActivityDetail(activity: ActivitySummaryInput) {
  const payload = activity.payload ?? {};
  const name = stringPayload(payload, "title") ?? stringPayload(payload, "name") ?? stringPayload(payload, "fileName");
  if (activity.eventType === "AttachmentAdded" || activity.eventType === "AttachmentDeleted") {
    const size = numberPayload(payload, "sizeBytes");
    return name ? "File: " + name + (size ? " · " + formatBytes(size) : "") : scopeLabel(activity);
  }
  if (name) return entityLabel(activity.entityType) + ": " + name;
  return scopeLabel(activity);
}

export function formatBytes(value: number) {
  if (value < 1024) return value + " B";
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return size.toFixed(size >= 10 ? 0 : 1) + " " + units[unitIndex];
}

export function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
}

export function taskStatusLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function workspaceRoleLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

export function projectRoleLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function entityLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function numberPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

function scopeLabel(activity: ActivitySummaryInput) {
  if (activity.taskId) return "Task activity";
  if (activity.projectId) return "Project activity";
  return "Workspace activity";
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function invitationStatus(invitation: {
  acceptedAt?: string | null;
  canceledAt?: string | null;
  declinedAt?: string | null;
  expiresAt: string;
}) {
  if (invitation.acceptedAt) return "accepted";
  if (invitation.canceledAt) return "canceled";
  if (invitation.declinedAt) return "declined";
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return "expired";
  return "pending";
}
