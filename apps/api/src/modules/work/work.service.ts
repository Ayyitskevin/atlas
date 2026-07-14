import type {
  ActivityQuery,
  AddTaskDependencyRequest,
  CreateAttachmentCommentRequest,
  CreateAttachmentRequest,
  CreateCommentRequest,
  CreateSectionRequest,
  CreateSubtaskRequest,
  CreateTaskLabelRequest,
  CreateTaskRequest,
  CursorPaginationQuery,
  MoveTaskRequest,
  MyWorkQuery,
  NotificationQuery,
  ProjectTaskQuery,
  ReplaceAttachmentRequest,
  ReorderSectionsRequest,
  SearchQuery,
  UpdateAttachmentCommentRequest,
  UpdateAttachmentRequest,
  UpdateCommentRequest,
  UpdateNotificationPreferenceRequest,
  UpdateSectionRequest,
  UpdateSubtaskRequest,
  UpdateTaskLabelRequest,
  UpdateTaskRequest,
} from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import type { AttachmentScanner } from "../../storage/attachment-scanner.js";
import { ActivityService } from "../activity/activity.service.js";
import { AttachmentsService } from "../attachments/attachments.service.js";
import { CommentsService } from "../comments/comments.service.js";
import { DependenciesService } from "../dependencies/dependencies.service.js";
import type { DomainEventsRepository } from "../events/domain-events.repository.js";
import { LabelsService } from "../labels/labels.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { PermissionsService } from "../permissions/permissions.service.js";
import { SearchService } from "../search/search.service.js";
import { SectionsService } from "../sections/sections.service.js";
import { SubtasksService } from "../subtasks/subtasks.service.js";
import { TasksService } from "../tasks/tasks.service.js";
import type { WorkRepository } from "./work.repository.js";

/**
 * Compatibility façade over domain services.
 * Prefer injecting SectionsService / TasksService / … directly in new code.
 */
export class WorkService {
  readonly sections: SectionsService;
  readonly tasks: TasksService;
  readonly labels: LabelsService;
  readonly dependencies: DependenciesService;
  readonly subtasks: SubtasksService;
  readonly comments: CommentsService;
  readonly attachments: AttachmentsService;
  readonly activity: ActivityService;
  readonly notifications: NotificationsService;
  readonly searchDomain: SearchService;

  constructor(
    workRepository: WorkRepository,
    events: DomainEventsRepository,
    permissions: PermissionsService,
    scanner?: AttachmentScanner,
  ) {
    this.sections = new SectionsService(workRepository, events, permissions, scanner);
    this.tasks = new TasksService(workRepository, events, permissions, scanner);
    this.labels = new LabelsService(workRepository, events, permissions, scanner);
    this.dependencies = new DependenciesService(workRepository, events, permissions, scanner);
    this.subtasks = new SubtasksService(workRepository, events, permissions, scanner);
    this.comments = new CommentsService(workRepository, events, permissions, scanner);
    this.attachments = new AttachmentsService(workRepository, events, permissions, scanner);
    this.activity = new ActivityService(workRepository, events, permissions, scanner);
    this.notifications = new NotificationsService(workRepository, events, permissions, scanner);
    this.searchDomain = new SearchService(workRepository, events, permissions, scanner);
  }

  createSection(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateSectionRequest) {
    return this.sections.createSection(ctx, workspaceId, projectId, input);
  }
  listSections(ctx: AuthContext, workspaceId: string, projectId: string, query: CursorPaginationQuery) {
    return this.sections.listSections(ctx, workspaceId, projectId, query);
  }
  updateSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string, input: UpdateSectionRequest) {
    return this.sections.updateSection(ctx, workspaceId, projectId, sectionId, input);
  }
  deleteSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string) {
    return this.sections.deleteSection(ctx, workspaceId, projectId, sectionId);
  }
  reorderSections(ctx: AuthContext, workspaceId: string, projectId: string, input: ReorderSectionsRequest) {
    return this.sections.reorderSections(ctx, workspaceId, projectId, input);
  }

  createTask(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateTaskRequest) {
    return this.tasks.createTask(ctx, workspaceId, projectId, input);
  }
  listTasks(ctx: AuthContext, workspaceId: string, projectId: string, query: ProjectTaskQuery) {
    return this.tasks.listTasks(ctx, workspaceId, projectId, query);
  }
  listMyWork(ctx: AuthContext, workspaceId: string, query: MyWorkQuery) {
    return this.tasks.listMyWork(ctx, workspaceId, query);
  }
  getTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.tasks.getTask(ctx, workspaceId, taskId);
  }
  updateTask(ctx: AuthContext, workspaceId: string, taskId: string, input: UpdateTaskRequest) {
    return this.tasks.updateTask(ctx, workspaceId, taskId, input);
  }
  deleteTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.tasks.deleteTask(ctx, workspaceId, taskId);
  }
  moveTask(ctx: AuthContext, workspaceId: string, taskId: string, input: MoveTaskRequest) {
    return this.tasks.moveTask(ctx, workspaceId, taskId, input);
  }
  assignTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    return this.tasks.assignTask(ctx, workspaceId, taskId, userId);
  }
  unassignTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    return this.tasks.unassignTask(ctx, workspaceId, taskId, userId);
  }
  listTaskWatchers(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.tasks.listTaskWatchers(ctx, workspaceId, taskId);
  }
  watchTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    return this.tasks.watchTask(ctx, workspaceId, taskId, userId);
  }
  unwatchTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    return this.tasks.unwatchTask(ctx, workspaceId, taskId, userId);
  }
  completeTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.tasks.completeTask(ctx, workspaceId, taskId);
  }
  skipRecurringTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.tasks.skipRecurringTask(ctx, workspaceId, taskId);
  }

  listLabels(ctx: AuthContext, workspaceId: string) {
    return this.labels.listLabels(ctx, workspaceId);
  }
  createLabel(ctx: AuthContext, workspaceId: string, input: CreateTaskLabelRequest) {
    return this.labels.createLabel(ctx, workspaceId, input);
  }
  updateLabel(ctx: AuthContext, workspaceId: string, labelId: string, input: UpdateTaskLabelRequest) {
    return this.labels.updateLabel(ctx, workspaceId, labelId, input);
  }
  deleteLabel(ctx: AuthContext, workspaceId: string, labelId: string) {
    return this.labels.deleteLabel(ctx, workspaceId, labelId);
  }
  listTaskLabels(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.labels.listTaskLabels(ctx, workspaceId, taskId);
  }
  assignTaskLabel(ctx: AuthContext, workspaceId: string, taskId: string, labelId: string) {
    return this.labels.assignTaskLabel(ctx, workspaceId, taskId, labelId);
  }
  unassignTaskLabel(ctx: AuthContext, workspaceId: string, taskId: string, labelId: string) {
    return this.labels.unassignTaskLabel(ctx, workspaceId, taskId, labelId);
  }

  listTaskDependencies(ctx: AuthContext, workspaceId: string, taskId: string) {
    return this.dependencies.listTaskDependencies(ctx, workspaceId, taskId);
  }
  listProjectDependencyMap(ctx: AuthContext, workspaceId: string, projectId: string) {
    return this.dependencies.listProjectDependencyMap(ctx, workspaceId, projectId);
  }
  addTaskDependency(ctx: AuthContext, workspaceId: string, taskId: string, input: AddTaskDependencyRequest) {
    return this.dependencies.addTaskDependency(ctx, workspaceId, taskId, input);
  }
  removeTaskDependency(ctx: AuthContext, workspaceId: string, dependencyId: string) {
    return this.dependencies.removeTaskDependency(ctx, workspaceId, dependencyId);
  }

  createSubtask(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateSubtaskRequest) {
    return this.subtasks.createSubtask(ctx, workspaceId, taskId, input);
  }
  listSubtasks(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    return this.subtasks.listSubtasks(ctx, workspaceId, taskId, query);
  }
  updateSubtask(ctx: AuthContext, workspaceId: string, subtaskId: string, input: UpdateSubtaskRequest) {
    return this.subtasks.updateSubtask(ctx, workspaceId, subtaskId, input);
  }
  deleteSubtask(ctx: AuthContext, workspaceId: string, subtaskId: string) {
    return this.subtasks.deleteSubtask(ctx, workspaceId, subtaskId);
  }

  createComment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateCommentRequest) {
    return this.comments.createComment(ctx, workspaceId, taskId, input);
  }
  listComments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    return this.comments.listComments(ctx, workspaceId, taskId, query);
  }
  updateComment(ctx: AuthContext, workspaceId: string, commentId: string, input: UpdateCommentRequest) {
    return this.comments.updateComment(ctx, workspaceId, commentId, input);
  }
  deleteComment(ctx: AuthContext, workspaceId: string, commentId: string) {
    return this.comments.deleteComment(ctx, workspaceId, commentId);
  }

  createAttachment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateAttachmentRequest) {
    return this.attachments.createAttachment(ctx, workspaceId, taskId, input);
  }
  completeAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    return this.attachments.completeAttachment(ctx, workspaceId, attachmentId);
  }
  listAttachments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    return this.attachments.listAttachments(ctx, workspaceId, taskId, query);
  }
  createAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentId: string, input: CreateAttachmentCommentRequest) {
    return this.attachments.createAttachmentComment(ctx, workspaceId, attachmentId, input);
  }
  listAttachmentComments(ctx: AuthContext, workspaceId: string, attachmentId: string, query: CursorPaginationQuery) {
    return this.attachments.listAttachmentComments(ctx, workspaceId, attachmentId, query);
  }
  updateAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentCommentId: string, input: UpdateAttachmentCommentRequest) {
    return this.attachments.updateAttachmentComment(ctx, workspaceId, attachmentCommentId, input);
  }
  deleteAttachmentComment(ctx: AuthContext, workspaceId: string, attachmentCommentId: string) {
    return this.attachments.deleteAttachmentComment(ctx, workspaceId, attachmentCommentId);
  }
  getAttachmentDownload(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    return this.attachments.getAttachmentDownload(ctx, workspaceId, attachmentId);
  }
  createAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, input: ReplaceAttachmentRequest) {
    return this.attachments.createAttachmentVersion(ctx, workspaceId, attachmentId, input);
  }
  completeAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, versionId: string) {
    return this.attachments.completeAttachmentVersion(ctx, workspaceId, attachmentId, versionId);
  }
  updateAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string, input: UpdateAttachmentRequest) {
    return this.attachments.updateAttachment(ctx, workspaceId, attachmentId, input);
  }
  deleteAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    return this.attachments.deleteAttachment(ctx, workspaceId, attachmentId);
  }

  listActivity(ctx: AuthContext, workspaceId: string, query: ActivityQuery) {
    return this.activity.listActivity(ctx, workspaceId, query);
  }

  listNotifications(ctx: AuthContext, workspaceId: string, query: NotificationQuery) {
    return this.notifications.listNotifications(ctx, workspaceId, query);
  }
  getNotificationPreferences(ctx: AuthContext, workspaceId: string) {
    return this.notifications.getNotificationPreferences(ctx, workspaceId);
  }
  updateNotificationPreferences(ctx: AuthContext, workspaceId: string, input: UpdateNotificationPreferenceRequest) {
    return this.notifications.updateNotificationPreferences(ctx, workspaceId, input);
  }
  markNotificationRead(ctx: AuthContext, workspaceId: string, notificationId: string) {
    return this.notifications.markNotificationRead(ctx, workspaceId, notificationId);
  }
  markAllNotificationsRead(ctx: AuthContext, workspaceId: string) {
    return this.notifications.markAllNotificationsRead(ctx, workspaceId);
  }

  search(ctx: AuthContext, workspaceId: string, query: SearchQuery) {
    return this.searchDomain.search(ctx, workspaceId, query);
  }
}
