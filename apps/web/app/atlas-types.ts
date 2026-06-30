export type AuthPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

export type User = {
  email: string;
  id: string;
  name: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

export type Project = {
  archivedAt?: string | null;
  description?: string | null;
  id: string;
  name: string;
  visibility: ProjectVisibility;
};

export type ProjectVisibility = "PRIVATE" | "WORKSPACE";

export type Section = {
  id: string;
  name: string;
  position?: number | string;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskAssignee = {
  assignedById?: string | null;
  createdAt?: string;
  id: string;
  taskId: string;
  userId: string;
  workspaceId?: string;
};

export type Task = {
  assignees?: TaskAssignee[];
  completedAt?: string | null;
  createdAt?: string;
  description?: string | null;
  dueDate?: string | null;
  id: string;
  position?: number | string;
  priority: TaskPriority;
  projectId: string;
  sectionId: string;
  status: TaskStatus;
  title: string;
  updatedAt?: string;
  version: number;
};

export type MyWorkDueFilter = "any" | "overdue" | "today" | "next7" | "unscheduled";
export type MyWorkStatusFilter = "all" | "done" | "open";

export type MyWorkTask = Task & {
  project: Pick<Project, "id" | "name" | "visibility">;
};

export type Subtask = {
  assigneeId: string | null;
  completedAt?: string | null;
  createdAt?: string;
  id: string;
  position?: number | string;
  status: TaskStatus;
  taskId: string;
  title: string;
  version: number;
};

export type Comment = {
  authorId?: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  id: string;
};

export type Attachment = {
  createdAt: string;
  fileName: string;
  id: string;
  mimeType: string;
  objectKey?: string;
  sizeBytes: number;
  taskId: string;
  uploadedById?: string;
};

export type AttachmentInstructions = {
  headers: Record<string, string>;
  method: "GET" | "PUT";
  url: string;
};

export type CreateAttachmentResponse = {
  attachment: Attachment;
  upload: AttachmentInstructions;
};

export type AttachmentDownloadResponse = {
  attachment: Attachment;
  download: AttachmentInstructions;
};

export type ActivityEvent = {
  actorUserId: string;
  createdAt: string;
  entityId: string;
  entityType: string;
  eventType: string;
  id: string;
  projectId: string | null;
  taskId: string | null;
};

export type Notification = {
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  status: "ARCHIVED" | "READ" | "UNREAD";
  taskId: string | null;
  title: string;
  type: string;
};

export type WorkspaceRole = "ADMIN" | "GUEST" | "MEMBER" | "OWNER";

export type WorkspaceMember = {
  createdAt?: string;
  id: string;
  joinedAt?: string;
  role: WorkspaceRole;
  user: User;
  userId: string;
  workspaceId: string;
};

export type WorkspaceInvitation = {
  acceptedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  declinedAt: string | null;
  email: string;
  expiresAt: string;
  id: string;
  invitedById: string;
  role: Exclude<WorkspaceRole, "OWNER">;
  workspaceId: string;
};

export type WorkspaceInvitationWithToken = WorkspaceInvitation & {
  acceptToken: string;
  status: "PENDING";
};

export type ResendWorkspaceInvitationResponse = {
  acceptToken: string;
  ok: boolean;
};

export type SearchResult =
  | { project: Project; type: "project" }
  | { task: Task; type: "task" };

export type OutboxStatus = "pending" | "failed" | "processed" | "locked" | "all";

export type OutboxEvent = {
  attempts: number;
  canReplay: boolean;
  createdAt: string;
  deadLettered: boolean;
  eventId: string;
  eventType: string;
  failedAt: string | null;
  id: string;
  lastError: string | null;
  lockedAt: string | null;
  nextAttemptAt: string | null;
  processedAt: string | null;
  status: Exclude<OutboxStatus, "all">;
  updatedAt: string;
  workspaceId: string | null;
};

export type OutboxAttempt = {
  attemptNumber: number;
  createdAt: string;
  error: string | null;
  finishedAt: string;
  id: string;
  startedAt: string;
  status: "failed" | "succeeded";
};

export type OutboxEventContext = {
  actorUserId: string | null;
  entityId: string | null;
  entityType: string | null;
  occurredAt: string | null;
  projectId: string | null;
  taskId: string | null;
  version: number | null;
};

export type OutboxEventDetail = OutboxEvent & {
  attemptHistory: OutboxAttempt[];
  context: OutboxEventContext;
  payload: Record<string, unknown>;
};

export type ReplayOutboxEventResponse = {
  event: OutboxEvent;
  replayQueued: boolean;
};

export type ActivityScope = "project" | "task" | "workspace";

export type Page<T> = {
  items: T[];
};
