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
  ProjectCreatedFromTemplate: "Project created from template",
  ProjectDeleted: "Project deleted",
  ProjectMemberAdded: "Project member added",
  ProjectMemberRemoved: "Project member removed",
  ProjectMemberUpdated: "Project member updated",
  ProjectMessageCreated: "Message posted",
  ProjectMessageDeleted: "Message deleted",
  ProjectMessagePinned: "Message pinned",
  ProjectMessageUnpinned: "Message unpinned",
  ProjectMessageUpdated: "Message updated",
  ProjectTemplateCreated: "Template saved",
  ProjectTemplateDeleted: "Template deleted",
  ProjectTemplateUpdated: "Template updated",
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
  TaskLabelAdded: "Label added",
  TaskLabelRemoved: "Label removed",
  TaskMoved: "Task moved",
  TaskRecurrenceGenerated: "Recurring task created",
  TaskUnassigned: "Task unassigned",
  TaskUpdated: "Task updated",
  TaskUnwatched: "Follower removed",
  TaskWatched: "Follower added",
  WorkspaceCreated: "Workspace created",
};

type ActivitySummaryInput = {
  entityType: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
  projectId?: string | null;
  taskId?: string | null;
};

export type ActivityMetadataItem = {
  label: string;
  value: string;
};

export function formatActivityTitle(eventType: string) {
  return activityTitles[eventType] ?? formatEventType(eventType);
}

export function formatActivityDetail(activity: ActivitySummaryInput) {
  const payload = activity.payload ?? {};
  if (activity.entityType === "task") return taskActivityDetail(activity, payload);
  if (activity.entityType === "project") return projectActivityDetail(activity, payload);
  if (activity.entityType === "project_member") return projectMemberActivityDetail(activity, payload);

  const name = stringPayload(payload, "title") ?? stringPayload(payload, "name") ?? stringPayload(payload, "fileName");
  if (activity.eventType === "AttachmentAdded" || activity.eventType === "AttachmentDeleted") {
    const size = numberPayload(payload, "sizeBytes");
    return name ? "File: " + name + (size ? " · " + formatBytes(size) : "") : scopeLabel(activity);
  }
  if (name) return entityLabel(activity.entityType) + ": " + name;
  return scopeLabel(activity);
}

export function formatActivityMetadata(activity: ActivitySummaryInput): ActivityMetadataItem[] {
  const payload = activity.payload ?? {};
  if (activity.entityType === "task") return taskActivityMetadata(payload);
  if (activity.entityType === "project") return projectActivityMetadata(payload);
  if (activity.entityType === "project_member") return projectMemberActivityMetadata(payload);
  if (activity.eventType === "AttachmentAdded" || activity.eventType === "AttachmentDeleted") {
    const size = numberPayload(payload, "sizeBytes");
    return size ? [{ label: "Size", value: formatBytes(size) }] : [];
  }
  return [];
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

export function taskRecurrenceLabel(frequency?: string | null, interval?: number | null) {
  if (!frequency) return "none";
  const normalizedInterval = interval && interval > 0 ? interval : 1;
  const unit = recurrenceUnit(frequency);
  if (normalizedInterval === 1) return frequency.toLowerCase();
  return "every " + normalizedInterval + " " + unit + "s";
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

function objectPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return isRecord(value) ? value : null;
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

function taskActivityDetail(activity: ActivitySummaryInput, payload: Record<string, unknown>) {
  const title = stringPayload(payload, "title");
  const detail = title ? "Task: " + title : scopeLabel(activity);
  const label = stringPayload(payload, "name");
  if ((activity.eventType === "TaskLabelAdded" || activity.eventType === "TaskLabelRemoved") && label) {
    return detail + " · label " + label;
  }
  if (activity.eventType === "TaskWatched" || activity.eventType === "TaskUnwatched") {
    const user = objectPayload(payload, "user");
    const name = user ? stringPayload(user, "name") ?? stringPayload(user, "email") : null;
    return name ? detail + " · follower " + name : detail;
  }
  const status = taskStatusChange(payload);
  const priority = stringPayload(payload, "priority");
  const dueDate = stringPayload(payload, "dueDate");
  const recurrence = stringPayload(payload, "recurrenceFrequency");
  const parts = [
    status,
    priority ? taskStatusLabel(priority) + " priority" : null,
    dueDate ? "due " + dueDate : null,
    recurrence ? taskRecurrenceLabel(recurrence, numberPayload(payload, "recurrenceInterval")) : null,
  ].filter(isString);
  return parts.length ? detail + " · " + parts.join(" · ") : detail;
}

function taskActivityMetadata(payload: Record<string, unknown>) {
  const items: ActivityMetadataItem[] = [];
  const status = taskStatusChange(payload);
  const priority = changedLabel(stringPayload(payload, "previousPriority"), stringPayload(payload, "priority"), taskStatusLabel);
  const dueDate = changedLabel(stringPayload(payload, "previousDueDate"), stringPayload(payload, "dueDate"), identityLabel);
  const label = stringPayload(payload, "name");
  const recurrence = stringPayload(payload, "recurrenceFrequency");
  if (status) items.push({ label: "Status", value: status });
  if (priority) items.push({ label: "Priority", value: priority });
  if (dueDate) items.push({ label: "Due", value: dueDate });
  if (recurrence) items.push({ label: "Repeat", value: taskRecurrenceLabel(recurrence, numberPayload(payload, "recurrenceInterval")) });
  if (label) items.push({ label: "Label", value: label });
  return items;
}

function projectActivityDetail(activity: ActivitySummaryInput, payload: Record<string, unknown>) {
  const name = stringPayload(payload, "name");
  const detail = name ? "Project: " + name : scopeLabel(activity);
  const visibility = stringPayload(payload, "visibility");
  const archivedAt = stringPayload(payload, "archivedAt");
  const parts = [
    visibility ? projectVisibilityLabel(visibility) : null,
    archivedAt ? "archived" : null,
  ].filter(isString);
  return parts.length ? detail + " · " + parts.join(" · ") : detail;
}

function projectActivityMetadata(payload: Record<string, unknown>) {
  const items: ActivityMetadataItem[] = [];
  const visibility = stringPayload(payload, "visibility");
  const archivedAt = stringPayload(payload, "archivedAt");
  if (visibility) items.push({ label: "Visibility", value: projectVisibilityLabel(visibility) });
  if (archivedAt) items.push({ label: "Archived", value: archivedAt.slice(0, 10) });
  return items;
}

function projectMemberActivityDetail(activity: ActivitySummaryInput, payload: Record<string, unknown>) {
  const user = objectPayload(payload, "user");
  const name = user ? stringPayload(user, "name") ?? stringPayload(user, "email") : null;
  const role = changedLabel(stringPayload(payload, "previousRole"), stringPayload(payload, "role"), projectRoleLabel);
  const detail = name ? "Member: " + name : scopeLabel(activity);
  return role ? detail + " · " + role : detail;
}

function projectMemberActivityMetadata(payload: Record<string, unknown>) {
  const items: ActivityMetadataItem[] = [];
  const user = objectPayload(payload, "user");
  const email = user ? stringPayload(user, "email") : null;
  const role = changedLabel(stringPayload(payload, "previousRole"), stringPayload(payload, "role"), projectRoleLabel);
  if (email) items.push({ label: "Member", value: email });
  if (role) items.push({ label: "Role", value: role });
  return items;
}

function taskStatusChange(payload: Record<string, unknown>) {
  return changedLabel(stringPayload(payload, "previousStatus"), stringPayload(payload, "status"), taskStatusLabel);
}

function changedLabel(previous: string | null, current: string | null, formatter: (value: string) => string) {
  if (previous && current && previous !== current) return formatter(previous) + " -> " + formatter(current);
  return current ? formatter(current) : null;
}

function identityLabel(value: string) {
  return value;
}

function projectVisibilityLabel(value: string) {
  return value.toLowerCase();
}

function recurrenceUnit(value: string) {
  if (value === "DAILY") return "day";
  if (value === "WEEKLY") return "week";
  if (value === "MONTHLY") return "month";
  return value.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isString(value: string | null): value is string {
  return Boolean(value);
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
