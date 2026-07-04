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

export type ProjectRole = "COMMENTER" | "EDITOR" | "PROJECT_ADMIN" | "VIEWER";
export type ProjectVisibility = "PRIVATE" | "WORKSPACE";

export type ProjectMember = {
  createdAt?: string;
  id: string;
  projectId: string;
  role: ProjectRole;
  user: User;
  userId: string;
};

export type ProjectMessage = {
  author: User;
  authorId: string;
  body: string;
  createdAt: string;
  id: string;
  pinnedAt: string | null;
  pinnedById: string | null;
  projectId: string;
  title: string;
  updatedAt: string;
  workspaceId: string;
};

export type ProjectTemplate = {
  _count?: {
    sections: number;
    tasks: number;
  };
  createdAt: string;
  createdBy?: User;
  createdById: string;
  deletedAt?: string | null;
  description?: string | null;
  id: string;
  name: string;
  updatedAt: string;
  workspaceId: string;
};

export type ProjectTemplateTaskAssignee = {
  id: string;
  user?: User;
  userId: string;
};

export type ProjectTemplateTaskLabelAssignment = {
  id: string;
  label: TaskLabel;
  labelId: string;
};

export type ProjectTemplateTask = {
  assignees?: ProjectTemplateTaskAssignee[];
  description?: string | null;
  dueDateOffsetDays?: number | null;
  id: string;
  labelAssignments?: ProjectTemplateTaskLabelAssignment[];
  position?: number | string;
  priority: TaskPriority;
  title: string;
};

export type ProjectTemplateSection = {
  id: string;
  name: string;
  position?: number | string;
  tasks: ProjectTemplateTask[];
};

export type ProjectTemplateDetail = ProjectTemplate & {
  sections: ProjectTemplateSection[];
};

export type Section = {
  id: string;
  name: string;
  position?: number | string;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskRecurrenceFrequency = "DAILY" | "MONTHLY" | "WEEKLY";

export type TaskAssignee = {
  assignedById?: string | null;
  createdAt?: string;
  id: string;
  taskId: string;
  userId: string;
  workspaceId?: string;
};

export type TaskLabel = {
  color: string;
  createdAt?: string;
  id: string;
  name: string;
  updatedAt?: string;
  workspaceId: string;
};

export type TaskLabelAssignment = {
  createdAt?: string;
  id: string;
  label: TaskLabel;
  labelId: string;
  taskId: string;
  workspaceId: string;
};

export type TaskWatcher = {
  createdAt: string;
  id: string;
  taskId: string;
  user: User;
  userId: string;
  watchedById?: string | null;
  workspaceId: string;
};

export type TaskDependencyTask = {
  assigneeCount?: number;
  dependencySummary?: TaskDependencySummary;
  dueDate?: string | null;
  id: string;
  priority?: TaskPriority;
  status: TaskStatus;
  title: string;
};

export type TaskDependencyEdge = {
  blockedTaskId: string;
  blockingTaskId: string;
  createdAt: string;
  id: string;
  task: TaskDependencyTask;
};

export type TaskDependencies = {
  blockedBy: TaskDependencyEdge[];
  blocks: TaskDependencyEdge[];
  isBlocked: boolean;
};

export type TaskDependencySummary = {
  blockedByOpenCount: number;
  blocksCount: number;
  isBlocked: boolean;
};

export type ProjectDependencyMapNode = {
  dependencySummary: TaskDependencySummary;
  dueDate: string | null;
  id: string;
  priority: TaskPriority;
  sectionId: string;
  status: TaskStatus;
  title: string;
};

export type ProjectDependencyMapEdge = {
  blockedTaskId: string;
  blockingTaskId: string;
  createdAt: string;
  id: string;
};

export type ProjectDependencyMap = {
  criticalPathTaskIds: string[];
  edges: ProjectDependencyMapEdge[];
  nodes: ProjectDependencyMapNode[];
  stats: {
    blockedTaskCount: number;
    blockingTaskCount: number;
    edgeCount: number;
    openEdgeCount: number;
    readyBlockerCount: number;
  };
};

export type Task = {
  assignees?: TaskAssignee[];
  completedAt?: string | null;
  createdAt?: string;
  dependencySummary?: TaskDependencySummary;
  description?: string | null;
  dueDate?: string | null;
  id: string;
  position?: number | string;
  priority: TaskPriority;
  projectId: string;
  recurrenceEndDate?: string | null;
  recurrenceFrequency?: TaskRecurrenceFrequency | null;
  recurrenceGeneratedFromTaskId?: string | null;
  recurrenceInterval?: number | null;
  recurrencePausedAt?: string | null;
  recurrenceSkippedAt?: string | null;
  sectionId: string;
  status: TaskStatus;
  title: string;
  updatedAt?: string;
  version: number;
};

export type MyWorkDueFilter = "any" | "overdue" | "today" | "next7" | "unscheduled";
export type TaskDependencyFilter = "any" | "blocked" | "blocking";
export type MyWorkDependencyFilter = TaskDependencyFilter;
export type MyWorkScopeFilter = "all" | "assigned" | "watching";
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
  description?: string | null;
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
  payload: Record<string, unknown>;
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

export type NotificationPreference = {
  emailEnabled: boolean;
  inAppEnabled: true;
  updatedAt: string | null;
  userId: string;
  workspaceId: string;
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

export type EmailDeliveryOutcome = {
  provider: string;
  providerMessageId?: string;
  reason?: string;
  recipientCount: number;
  status: "delivered" | "failed" | "stubbed";
};

export type WorkspaceInvitationWithToken = WorkspaceInvitation & {
  acceptToken: string;
  emailDelivery: EmailDeliveryOutcome;
  status: "PENDING";
};

export type AcceptWorkspaceInvitationResponse = {
  member: WorkspaceMember;
};

export type ResendWorkspaceInvitationResponse = {
  acceptToken: string;
  emailDelivery: EmailDeliveryOutcome;
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

export type WorkerOutcome = {
  createdAt: string;
  eventId: string;
  id: string;
  jobId: string | null;
  provider: string | null;
  providerMessageId: string | null;
  queue: string;
  reason: string | null;
  recipientCount: number | null;
  status: "delivered" | "failed" | "skipped" | "stubbed";
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
  workerOutcomes: WorkerOutcome[];
};

export type ReplayOutboxEventResponse = {
  event: OutboxEvent;
  replayQueued: boolean;
};

export type ActivityScope = "project" | "task" | "workspace";

export type PageInfo = {
  hasNextPage: boolean;
  nextCursor: string | null;
};

export type Page<T> = {
  items: T[];
  pageInfo?: PageInfo;
};
