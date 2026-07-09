import type { PrismaClient, TaskPriority, TaskRecurrenceFrequency, TaskStatus } from "@atlas/db";
import type {
  MyWorkDependencyFilter,
  MyWorkDueFilter,
  MyWorkScopeFilter,
  MyWorkStatusFilter,
  ProjectTaskQuery,
  SearchResultType,
} from "@atlas/shared";

import { ActivityRepository } from "../activity/activity.repository.js";
import { AttachmentsRepository } from "../attachments/attachments.repository.js";
import { CommentsRepository } from "../comments/comments.repository.js";
import { DependenciesRepository } from "../dependencies/dependencies.repository.js";
import { LabelsRepository } from "../labels/labels.repository.js";
import { NotificationsRepository } from "../notifications/notifications.repository.js";
import { SearchRepository } from "../search/search.repository.js";
import { SectionsRepository } from "../sections/sections.repository.js";
import { SubtasksRepository } from "../subtasks/subtasks.repository.js";
import { TasksRepository } from "../tasks/tasks.repository.js";
import type { AttachmentScanWrite, SearchWorkspaceCursor } from "./work-repository-helpers.js";

/**
 * Compatibility façade over domain repositories.
 * Prefer SectionsRepository / TasksRepository / … in new code.
 */
export class WorkRepository {
  readonly sections: SectionsRepository;
  readonly tasks: TasksRepository;
  readonly labels: LabelsRepository;
  readonly dependencies: DependenciesRepository;
  readonly subtasks: SubtasksRepository;
  readonly comments: CommentsRepository;
  readonly attachments: AttachmentsRepository;
  readonly activity: ActivityRepository;
  readonly notifications: NotificationsRepository;
  readonly searchRepo: SearchRepository;

  constructor(prisma: PrismaClient) {
    this.sections = new SectionsRepository(prisma);
    this.tasks = new TasksRepository(prisma);
    this.labels = new LabelsRepository(prisma);
    this.dependencies = new DependenciesRepository(prisma);
    this.subtasks = new SubtasksRepository(prisma);
    this.comments = new CommentsRepository(prisma);
    this.attachments = new AttachmentsRepository(prisma);
    this.activity = new ActivityRepository(prisma);
    this.notifications = new NotificationsRepository(prisma);
    this.searchRepo = new SearchRepository(prisma);
  }

  createSection(input: { name: string; position: number; projectId: string; workspaceId: string }) {
    return this.sections.createSection(input);
  }

  findSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    return this.sections.findSection(input);
  }

  countSections(input: { projectId: string; sectionIds: string[]; workspaceId: string }) {
    return this.sections.countSections(input);
  }

  listSections(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.sections.listSections(input);
  }

  async updateSection(input: { data: { name?: string; position?: number }; projectId: string; sectionId: string; workspaceId: string }) {
    return this.sections.updateSection(input);
  }

  async softDeleteSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    return this.sections.softDeleteSection(input);
  }

  async reorderSections(input: { projectId: string; sections: Array<{ id: string; position: number }>; workspaceId: string }) {
    return this.sections.reorderSections(input);
  }

  createTask(input: {
  assigneeIds: string[];
  description?: string;
  dueDate?: string;
  position: number;
  priority: TaskPriority;
  recurrenceEndDate?: string | null;
  recurrenceFrequency?: TaskRecurrenceFrequency | null;
  recurrenceInterval?: number | null;
  projectId: string;
  sectionId: string;
  title: string;
  workspaceId: string;
}) {
    return this.tasks.createTask(input);
  }

  listTasks(input: ProjectTaskQuery & { projectId: string; workspaceId: string }) {
    return this.tasks.listTasks(input);
  }

  listMyWork(input: {
  cursor?: string;
  dependency: MyWorkDependencyFilter;
  due: MyWorkDueFilter;
  limit: number;
  scope: MyWorkScopeFilter;
  status: MyWorkStatusFilter;
  userId: string;
  workspaceId: string;
}) {
    return this.tasks.listMyWork(input);
  }

  findTask(workspaceId: string, taskId: string) {
    return this.tasks.findTask(workspaceId, taskId);
  }

  async updateTask(input: {
  data: {
    description?: string | null;
    dueDate?: string | null;
    priority?: TaskPriority;
    recurrenceEndDate?: string | null;
    recurrenceFrequency?: TaskRecurrenceFrequency | null;
    recurrenceInterval?: number | null;
    recurrencePausedAt?: Date | null;
    recurrenceSkippedAt?: Date | null;
    status?: TaskStatus;
    title?: string;
  };
  taskId: string;
  version: number;
  workspaceId: string;
}) {
    return this.tasks.updateTask(input);
  }

  createRecurringTask(input: {
  assigneeIds: string[];
  description?: string | null;
  dueDate: string | null;
  generatedFromTaskId: string;
  position: number;
  priority: TaskPriority;
  projectId: string;
  recurrenceEndDate?: string | null;
  recurrenceFrequency: TaskRecurrenceFrequency;
  recurrenceInterval: number;
  sectionId: string;
  title: string;
  workspaceId: string;
}) {
    return this.tasks.createRecurringTask(input);
  }

  async moveTask(input: { position: number; sectionId: string; taskId: string; version: number; workspaceId: string }) {
    return this.tasks.moveTask(input);
  }

  softDeleteTask(workspaceId: string, taskId: string) {
    return this.tasks.softDeleteTask(workspaceId, taskId);
  }

  assignTask(input: { assignedById: string; taskId: string; userId: string; workspaceId: string }) {
    return this.tasks.assignTask(input);
  }

  unassignTask(input: { taskId: string; userId: string; workspaceId: string }) {
    return this.tasks.unassignTask(input);
  }

  listTaskWatchers(input: { taskId: string; workspaceId: string }) {
    return this.tasks.listTaskWatchers(input);
  }

  watchTask(input: { taskId: string; userId: string; watchedById: string; workspaceId: string }) {
    return this.tasks.watchTask(input);
  }

  unwatchTask(input: { taskId: string; userId: string; workspaceId: string }) {
    return this.tasks.unwatchTask(input);
  }

  countWorkspaceMembers(input: { userIds: string[]; workspaceId: string }) {
    return this.tasks.countWorkspaceMembers(input);
  }

  listLabels(input: { workspaceId: string }) {
    return this.labels.listLabels(input);
  }

  createLabel(input: { color: string; name: string; workspaceId: string }) {
    return this.labels.createLabel(input);
  }

  findLabel(input: { labelId: string; workspaceId: string }) {
    return this.labels.findLabel(input);
  }

  async updateLabel(input: { data: { color?: string; name?: string }; labelId: string; workspaceId: string }) {
    return this.labels.updateLabel(input);
  }

  deleteLabel(input: { labelId: string; workspaceId: string }) {
    return this.labels.deleteLabel(input);
  }

  listTaskLabels(input: { taskId: string; workspaceId: string }) {
    return this.labels.listTaskLabels(input);
  }

  assignTaskLabel(input: { assignedById: string; labelId: string; taskId: string; workspaceId: string }) {
    return this.labels.assignTaskLabel(input);
  }

  unassignTaskLabel(input: { labelId: string; taskId: string; workspaceId: string }) {
    return this.labels.unassignTaskLabel(input);
  }

  listTaskDependencies(input: { taskId: string; workspaceId: string }) {
    return this.dependencies.listTaskDependencies(input);
  }

  listProjectDependencyEdges(input: { projectId: string; workspaceId: string }) {
    return this.dependencies.listProjectDependencyEdges(input);
  }

  listProjectDependencyMapRows(input: { projectId: string; workspaceId: string }) {
    return this.dependencies.listProjectDependencyMapRows(input);
  }

  listTaskDependencySummaryRows(input: { taskIds: string[]; workspaceId: string }) {
    return this.dependencies.listTaskDependencySummaryRows(input);
  }

  listTasksUnblockedByCompletion(input: { blockingTaskId: string; workspaceId: string }) {
    return this.dependencies.listTasksUnblockedByCompletion(input);
  }

  findTaskDependencyByPair(input: { blockedTaskId: string; blockingTaskId: string; workspaceId: string }) {
    return this.dependencies.findTaskDependencyByPair(input);
  }

  findTaskDependency(input: { dependencyId: string; workspaceId: string }) {
    return this.dependencies.findTaskDependency(input);
  }

  createTaskDependency(input: { blockedTaskId: string; blockingTaskId: string; createdById: string; workspaceId: string }) {
    return this.dependencies.createTaskDependency(input);
  }

  deleteTaskDependency(input: { dependencyId: string; workspaceId: string }) {
    return this.dependencies.deleteTaskDependency(input);
  }

  createSubtask(input: { assigneeId?: string | null; position: number; taskId: string; title: string; workspaceId: string }) {
    return this.subtasks.createSubtask(input);
  }

  listSubtasks(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.subtasks.listSubtasks(input);
  }

  async updateSubtask(input: {
  data: { assigneeId?: string | null; status?: TaskStatus; title?: string };
  subtaskId: string;
  version: number;
  workspaceId: string;
}) {
    return this.subtasks.updateSubtask(input);
  }

  softDeleteSubtask(workspaceId: string, subtaskId: string) {
    return this.subtasks.softDeleteSubtask(workspaceId, subtaskId);
  }

  findSubtask(workspaceId: string, subtaskId: string) {
    return this.subtasks.findSubtask(workspaceId, subtaskId);
  }

  createComment(input: { authorId: string; body: string; taskId: string; workspaceId: string }) {
    return this.comments.createComment(input);
  }

  listComments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.comments.listComments(input);
  }

  findComment(workspaceId: string, commentId: string) {
    return this.comments.findComment(workspaceId, commentId);
  }

  async updateComment(input: { body: string; commentId: string; workspaceId: string }) {
    return this.comments.updateComment(input);
  }

  softDeleteComment(input: { commentId: string; workspaceId: string }) {
    return this.comments.softDeleteComment(input);
  }

  createAttachment(input: {
  description?: string | null;
  fileName: string;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
  taskId: string;
  uploadedById: string;
  workspaceId: string;
}) {
    return this.attachments.createAttachment(input);
  }

  listAttachments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.attachments.listAttachments(input);
  }

  createAttachmentComment(input: { attachmentId: string; authorId: string; body: string; versionId?: string | null; workspaceId: string }) {
    return this.attachments.createAttachmentComment(input);
  }

  listAttachmentComments(input: { attachmentId: string; cursor?: string; limit: number; workspaceId: string }) {
    return this.attachments.listAttachmentComments(input);
  }

  findAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.attachments.findAttachmentComment(input);
  }

  async updateAttachmentComment(input: { attachmentCommentId: string; body: string; workspaceId: string }) {
    return this.attachments.updateAttachmentComment(input);
  }

  softDeleteAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.attachments.softDeleteAttachmentComment(input);
  }

  findAttachment(workspaceId: string, attachmentId: string) {
    return this.attachments.findAttachment(workspaceId, attachmentId);
  }

  findAttachmentIncludingPending(workspaceId: string, attachmentId: string) {
    return this.attachments.findAttachmentIncludingPending(workspaceId, attachmentId);
  }

  async recordAttachmentScanResult(input: { attachmentId: string; scan: AttachmentScanWrite; workspaceId: string }) {
    return this.attachments.recordAttachmentScanResult(input);
  }

  async recordAttachmentVersionScanResult(input: { scan: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    return this.attachments.recordAttachmentVersionScanResult(input);
  }

  completeAttachment(input: { attachmentId: string; scan?: AttachmentScanWrite; workspaceId: string }) {
    return this.attachments.completeAttachment(input);
  }

  async updateAttachment(input: { attachmentId: string; description: string | null; workspaceId: string }) {
    return this.attachments.updateAttachment(input);
  }

  prepareAttachmentVersion(input: {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
  uploadedById: string;
  version: number;
  workspaceId: string;
}) {
    return this.attachments.prepareAttachmentVersion(input);
  }

  findAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.attachments.findAttachmentVersion(input);
  }

  findActiveAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.attachments.findActiveAttachmentVersion(input);
  }

  completeAttachmentVersion(input: { attachmentId: string; scan?: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    return this.attachments.completeAttachmentVersion(input);
  }

  softDeleteAttachment(input: { attachmentId: string; workspaceId: string }) {
    return this.attachments.softDeleteAttachment(input);
  }

  listActivity(input: { cursor?: string; limit: number; projectId?: string; taskId?: string; workspaceId: string }) {
    return this.activity.listActivity(input);
  }

  listNotifications(input: { cursor?: string; limit: number; recipientId: string; unreadOnly?: boolean; workspaceId: string }) {
    return this.notifications.listNotifications(input);
  }

  markNotificationRead(input: { notificationId: string; recipientId: string; workspaceId: string }) {
    return this.notifications.markNotificationRead(input);
  }

  markAllNotificationsRead(input: { recipientId: string; workspaceId: string }) {
    return this.notifications.markAllNotificationsRead(input);
  }

  findNotificationPreference(input: { userId: string; workspaceId: string }) {
    return this.notifications.findNotificationPreference(input);
  }

  upsertNotificationPreference(input: { emailEnabled: boolean; userId: string; workspaceId: string }) {
    return this.notifications.upsertNotificationPreference(input);
  }

  searchWorkspace(input: { after?: SearchWorkspaceCursor; limit: number; q: string; type?: SearchResultType; userId: string; workspaceId: string }) {
    return this.searchRepo.searchWorkspace(input);
  }

}
