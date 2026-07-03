import {
  ATLAS_ERROR_CODES,
  type ActivityQuery,
  type CreateAttachmentRequest,
  type CreateCommentRequest,
  type CreateSectionRequest,
  type CreateSubtaskRequest,
  type CreateTaskLabelRequest,
  type CreateTaskRequest,
  type CursorPaginationQuery,
  type MoveTaskRequest,
  type MyWorkQuery,
  type NotificationQuery,
  type UpdateNotificationPreferenceRequest,
  type ReorderSectionsRequest,
  searchCursorSchema,
  type SearchQuery,
  type SearchResultType,
  type UpdateCommentRequest,
  type UpdateTaskLabelRequest,
  type UpdateSectionRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
} from "@atlas/shared";
import { Prisma } from "@atlas/db";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { createAttachmentObjectKey, createDownloadInstructions, createUploadInstructions } from "../../storage/object-storage.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { defaultListPosition } from "./position.js";
import { WorkRepository } from "./work.repository.js";

export class WorkService {
  constructor(
    private readonly workRepository: WorkRepository,
    private readonly events: DomainEventsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async createSection(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateSectionRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.workRepository.createSection({
      name: input.name,
      position: input.position ?? defaultListPosition(),
      projectId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionCreated",
      projectId,
      workspaceId,
    });
    return section;
  }

  async listSections(ctx: AuthContext, workspaceId: string, projectId: string, query: CursorPaginationQuery) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    return pageFromLimit(await this.workRepository.listSections({ ...query, projectId, workspaceId }), query.limit);
  }

  async updateSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string, input: UpdateSectionRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.workRepository.updateSection({ data: input, projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionUpdated",
      payload: { name: section.name, position: String(section.position) },
      projectId,
      workspaceId,
    });
    return section;
  }

  async deleteSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.workRepository.findSection({ projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
    await this.workRepository.softDeleteSection({ projectId, sectionId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: section.id,
      entityType: "section",
      eventType: "SectionDeleted",
      payload: { name: section.name },
      projectId,
      workspaceId,
    });
    return { ok: true };
  }

  async reorderSections(ctx: AuthContext, workspaceId: string, projectId: string, input: ReorderSectionsRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    await this.requireSectionsInProject(workspaceId, projectId, input.sections.map((section) => section.id));
    await this.workRepository.reorderSections({ projectId, sections: input.sections, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: projectId,
      entityType: "project",
      eventType: "SectionsReordered",
      projectId,
      workspaceId,
    });
    return { ok: true };
  }

  async createTask(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateTaskRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    await this.requireSectionInProject(workspaceId, projectId, input.sectionId);
    await this.requireWorkspaceMembers(workspaceId, input.assigneeIds);
    const task = await this.workRepository.createTask({
      ...input,
      position: input.position ?? defaultListPosition(),
      projectId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: task.id,
      entityType: "task",
      eventType: "TaskCreated",
      payload: taskAuditPayload(task),
      projectId,
      taskId: task.id,
      workspaceId,
    });
    return task;
  }

  async listTasks(ctx: AuthContext, workspaceId: string, projectId: string, query: CursorPaginationQuery) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    return pageFromLimit(await this.workRepository.listTasks({ ...query, projectId, workspaceId }), query.limit);
  }

  async listMyWork(ctx: AuthContext, workspaceId: string, query: MyWorkQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(
      await this.workRepository.listMyWork({ ...query, userId: ctx.userId, workspaceId }),
      query.limit,
    );
  }

  async getTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    const task = await this.workRepository.findTask(workspaceId, taskId);
    if (!task) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    return task;
  }

  async updateTask(ctx: AuthContext, workspaceId: string, taskId: string, input: UpdateTaskRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    const count = await this.workRepository.updateTask({
      data: {
        description: input.description,
        dueDate: input.dueDate,
        priority: input.priority,
        status: input.status,
        title: input.title,
      },
      taskId,
      version: input.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const updated = await this.workRepository.findTask(workspaceId, taskId);
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    const eventType = updated.status === "DONE" && task.status !== "DONE" ? "TaskCompleted" : "TaskUpdated";
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType,
      payload: taskAuditPayload(updated, task),
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return updated;
  }

  async deleteTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "EDITOR");
    await this.workRepository.softDeleteTask(workspaceId, taskId);
    return { ok: true };
  }

  async moveTask(ctx: AuthContext, workspaceId: string, taskId: string, input: MoveTaskRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.requireSectionInProject(workspaceId, task.projectId, input.sectionId);
    const count = await this.workRepository.moveTask({ ...input, taskId, workspaceId });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const moved = await this.workRepository.findTask(workspaceId, taskId);
    if (!moved) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskMoved",
      payload: { ...taskAuditPayload(moved), fromSectionId: task.sectionId, toSectionId: input.sectionId },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return moved;
  }

  async assignTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.requireWorkspaceMembers(workspaceId, [userId]);
    const assignment = await this.workRepository.assignTask({ assignedById: ctx.userId, taskId, userId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskAssigned",
      payload: { userId },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return assignment;
  }

  async unassignTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.workRepository.unassignTask({ taskId, userId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskUnassigned",
      payload: { userId },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async listTaskWatchers(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listTaskWatchers({ taskId, workspaceId }), 100);
  }

  async watchTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (userId !== ctx.userId) await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.requireWorkspaceMembers(workspaceId, [userId]);
    const watcher = await this.workRepository.watchTask({ taskId, userId, watchedById: ctx.userId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskWatched",
      payload: { title: task.title, user: watcher.user, userId },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return watcher;
  }

  async unwatchTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (userId !== ctx.userId) await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    const result = await this.workRepository.unwatchTask({ taskId, userId, workspaceId });
    if (!result.count) return { ok: true };
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskUnwatched",
      payload: { title: task.title, userId },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async listLabels(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(await this.workRepository.listLabels({ workspaceId }), 100);
  }

  async createLabel(ctx: AuthContext, workspaceId: string, input: CreateTaskLabelRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "MEMBER");
    try {
      return await this.workRepository.createLabel({ color: input.color, name: input.name, workspaceId });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "A label with that name already exists in this Workspace.");
      }
      throw error;
    }
  }

  async updateLabel(ctx: AuthContext, workspaceId: string, labelId: string, input: UpdateTaskLabelRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "MEMBER");
    try {
      const label = await this.workRepository.updateLabel({ data: input, labelId, workspaceId });
      if (!label) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Label not found in this Workspace.");
      return label;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "A label with that name already exists in this Workspace.");
      }
      throw error;
    }
  }

  async deleteLabel(ctx: AuthContext, workspaceId: string, labelId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "MEMBER");
    const result = await this.workRepository.deleteLabel({ labelId, workspaceId });
    if (!result.count) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Label not found in this Workspace.");
    return { ok: true };
  }

  async listTaskLabels(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listTaskLabels({ taskId, workspaceId }), 100);
  }

  async assignTaskLabel(ctx: AuthContext, workspaceId: string, taskId: string, labelId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    const label = await this.workRepository.findLabel({ labelId, workspaceId });
    if (!label) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Label not found in this Workspace.");
    const assignment = await this.workRepository.assignTaskLabel({
      assignedById: ctx.userId,
      labelId,
      taskId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskLabelAdded",
      payload: { color: label.color, labelId: label.id, name: label.name, title: task.title },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return assignment;
  }

  async unassignTaskLabel(ctx: AuthContext, workspaceId: string, taskId: string, labelId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    const label = await this.workRepository.findLabel({ labelId, workspaceId });
    if (!label) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Label not found in this Workspace.");
    const result = await this.workRepository.unassignTaskLabel({ labelId, taskId, workspaceId });
    if (!result.count) return { ok: true };
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskLabelRemoved",
      payload: { color: label.color, labelId: label.id, name: label.name, title: task.title },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async completeTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (task.status === "DONE") return task;
    return this.updateTask(ctx, workspaceId, taskId, { status: "DONE", version: task.version });
  }

  async createSubtask(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateSubtaskRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    if (input.assigneeId) await this.requireWorkspaceMembers(workspaceId, [input.assigneeId]);
    const subtask = await this.workRepository.createSubtask({
      ...input,
      position: input.position ?? defaultListPosition(),
      taskId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: subtask.id,
      entityType: "subtask",
      eventType: "SubtaskCreated",
      payload: { title: subtask.title },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return subtask;
  }

  async listSubtasks(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listSubtasks({ ...query, taskId, workspaceId }), query.limit);
  }

  async updateSubtask(ctx: AuthContext, workspaceId: string, subtaskId: string, input: UpdateSubtaskRequest) {
    const subtask = await this.workRepository.findSubtask(workspaceId, subtaskId);
    if (!subtask) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Subtask not found.");
    const task = await this.getTask(ctx, workspaceId, subtask.taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    if (input.assigneeId) await this.requireWorkspaceMembers(workspaceId, [input.assigneeId]);
    const count = await this.workRepository.updateSubtask({
      data: { assigneeId: input.assigneeId, status: input.status, title: input.title },
      subtaskId,
      version: input.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Subtask has changed since it was loaded.");
    const updated = await this.workRepository.findSubtask(workspaceId, subtaskId);
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Subtask not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: subtaskId,
      entityType: "subtask",
      eventType: "SubtaskUpdated",
      payload: { status: updated.status, title: updated.title },
      projectId: task.projectId,
      taskId: subtask.taskId,
      workspaceId,
    });
    return updated;
  }

  async deleteSubtask(ctx: AuthContext, workspaceId: string, subtaskId: string) {
    const subtask = await this.workRepository.findSubtask(workspaceId, subtaskId);
    if (!subtask) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Subtask not found.");
    const task = await this.getTask(ctx, workspaceId, subtask.taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.workRepository.softDeleteSubtask(workspaceId, subtaskId);
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: subtaskId,
      entityType: "subtask",
      eventType: "SubtaskDeleted",
      payload: { status: subtask.status, title: subtask.title },
      projectId: task.projectId,
      taskId: subtask.taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async createComment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateCommentRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "COMMENTER");
    const comment = await this.workRepository.createComment({ authorId: ctx.userId, body: input.body, taskId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: comment.id,
      entityType: "comment",
      eventType: "CommentCreated",
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return comment;
  }

  async listComments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listComments({ ...query, taskId, workspaceId }), query.limit);
  }

  async updateComment(ctx: AuthContext, workspaceId: string, commentId: string, input: UpdateCommentRequest) {
    const comment = await this.workRepository.findComment(workspaceId, commentId);
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    const task = await this.getTask(ctx, workspaceId, comment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    const updated = await this.workRepository.updateComment({ body: input.body, commentId, workspaceId });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: commentId,
      entityType: "comment",
      eventType: "CommentUpdated",
      projectId: task.projectId,
      taskId: comment.taskId,
      workspaceId,
    });
    return updated;
  }

  async deleteComment(ctx: AuthContext, workspaceId: string, commentId: string) {
    const comment = await this.workRepository.findComment(workspaceId, commentId);
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    const task = await this.getTask(ctx, workspaceId, comment.taskId);
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    await this.workRepository.softDeleteComment({ commentId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: commentId,
      entityType: "comment",
      eventType: "CommentDeleted",
      projectId: task.projectId,
      taskId: comment.taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async createAttachment(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateAttachmentRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "COMMENTER");
    const objectKey = createAttachmentObjectKey({ fileName: input.fileName, taskId, workspaceId });
    const attachment = await this.workRepository.createAttachment({
      fileName: input.fileName,
      mimeType: input.mimeType,
      objectKey,
      sizeBytes: input.sizeBytes,
      taskId,
      uploadedById: ctx.userId,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachment.id,
      entityType: "attachment",
      eventType: "AttachmentAdded",
      payload: { attachmentId: attachment.id, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return { attachment, upload: await createUploadInstructions({ mimeType: attachment.mimeType, objectKey: attachment.objectKey }) };
  }

  async listAttachments(ctx: AuthContext, workspaceId: string, taskId: string, query: CursorPaginationQuery) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    return pageFromLimit(await this.workRepository.listAttachments({ ...query, taskId, workspaceId }), query.limit);
  }

  async getAttachmentDownload(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, "VIEWER");
    return { attachment, download: await createDownloadInstructions(attachment.objectKey) };
  }

  async deleteAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    await this.workRepository.softDeleteAttachment({ attachmentId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentId,
      entityType: "attachment",
      eventType: "AttachmentDeleted",
      payload: { attachmentId, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return { ok: true };
  }

  async listActivity(ctx: AuthContext, workspaceId: string, query: ActivityQuery) {
    if (query.taskId) {
      await this.permissions.requireTaskRole(ctx, workspaceId, query.taskId, "VIEWER");
    } else if (query.projectId) {
      await this.permissions.requireProjectRole(ctx, workspaceId, query.projectId, "VIEWER");
    } else {
      await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    }
    return pageFromLimit(await this.workRepository.listActivity({ ...query, workspaceId }), query.limit);
  }

  async listNotifications(ctx: AuthContext, workspaceId: string, query: NotificationQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(
      await this.workRepository.listNotifications({ ...query, recipientId: ctx.userId, workspaceId }),
      query.limit,
    );
  }

  async getNotificationPreferences(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const preference = await this.workRepository.findNotificationPreference({ userId: ctx.userId, workspaceId });
    return notificationPreferenceResponse({
      emailEnabled: preference?.emailEnabled ?? false,
      updatedAt: preference?.updatedAt ?? null,
      userId: ctx.userId,
      workspaceId,
    });
  }

  async updateNotificationPreferences(ctx: AuthContext, workspaceId: string, input: UpdateNotificationPreferenceRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const preference = await this.workRepository.upsertNotificationPreference({
      emailEnabled: input.emailEnabled,
      userId: ctx.userId,
      workspaceId,
    });
    return notificationPreferenceResponse({
      emailEnabled: preference.emailEnabled,
      updatedAt: preference.updatedAt,
      userId: ctx.userId,
      workspaceId,
    });
  }

  async markNotificationRead(ctx: AuthContext, workspaceId: string, notificationId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    await this.workRepository.markNotificationRead({ notificationId, recipientId: ctx.userId, workspaceId });
    return { ok: true };
  }

  async markAllNotificationsRead(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    await this.workRepository.markAllNotificationsRead({ recipientId: ctx.userId, workspaceId });
    return { ok: true };
  }

  async search(ctx: AuthContext, workspaceId: string, query: SearchQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const after = decodeSearchCursor(query.cursor, query.type);
    const [tasks, projects] = await this.workRepository.searchWorkspace({ ...query, after, userId: ctx.userId, workspaceId });
    const items: SearchResultItem[] = [
      ...projects.map((project) => ({ type: "project" as const, project })),
      ...tasks.map((task) => ({ type: "task" as const, task })),
    ].sort(compareSearchResults);
    const pageItems = items.slice(0, query.limit);
    const hasNextPage = items.length > query.limit;
    const lastPageItem = pageItems.at(-1);
    return {
      items: pageItems,
      pageInfo: {
        hasNextPage,
        nextCursor: hasNextPage && lastPageItem ? encodeSearchCursor(lastPageItem) : null,
      },
    };
  }

  private async requireSectionInProject(workspaceId: string, projectId: string, sectionId: string) {
    const section = await this.workRepository.findSection({ projectId, sectionId, workspaceId });
    if (!section) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
  }

  private async requireSectionsInProject(workspaceId: string, projectId: string, sectionIds: string[]) {
    const ids = [...new Set(sectionIds)];
    const count = await this.workRepository.countSections({ projectId, sectionIds: ids, workspaceId });
    if (count !== ids.length) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "One or more Sections were not found in this Project.");
  }

  private async requireWorkspaceMembers(workspaceId: string, userIds: string[]) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return;
    const count = await this.workRepository.countWorkspaceMembers({ userIds: ids, workspaceId });
    if (count !== ids.length) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "One or more assignees are not active members of this Workspace.");
    }
  }
}

function taskAuditPayload(
  task: { dueDate?: Date | string | null; priority: string; sectionId: string; status: string; title: string },
  previous?: { dueDate?: Date | string | null; priority: string; status: string; title: string },
) {
  const payload: Record<string, string | null> = {
    dueDate: datePayloadValue(task.dueDate),
    priority: task.priority,
    sectionId: task.sectionId,
    status: task.status,
    title: task.title,
  };
  if (!previous) return payload;
  if (previous.title !== task.title) payload.previousTitle = previous.title;
  if (previous.status !== task.status) payload.previousStatus = previous.status;
  if (previous.priority !== task.priority) payload.previousPriority = previous.priority;
  const previousDueDate = datePayloadValue(previous.dueDate);
  if (previousDueDate !== payload.dueDate) payload.previousDueDate = previousDueDate;
  return payload;
}

function datePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type SearchCursor = {
  id: string;
  type: SearchResultType;
  updatedAt: Date;
};

type SearchResultItem =
  | { project: { id: string; updatedAt: Date }; type: "project" }
  | { task: { id: string; updatedAt: Date }; type: "task" };

const searchResultTypeRank: Record<SearchResultType, number> = {
  project: 0,
  task: 1,
};

function compareSearchResults(left: SearchResultItem, right: SearchResultItem) {
  const updatedAtDelta = searchResultUpdatedAt(right).getTime() - searchResultUpdatedAt(left).getTime();
  if (updatedAtDelta) return updatedAtDelta;
  const typeDelta = searchResultRank(left.type) - searchResultRank(right.type);
  if (typeDelta) return typeDelta;
  return searchResultId(left).localeCompare(searchResultId(right));
}

function decodeSearchCursor(cursor?: string, requestedType?: SearchResultType): SearchCursor | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = searchCursorSchema.safeParse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (!parsed.success) throw new Error("Invalid cursor payload.");
    if (requestedType && parsed.data.type !== requestedType) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Search cursor does not match the requested result type.");
    }
    return {
      id: parsed.data.id,
      type: parsed.data.type,
      updatedAt: new Date(parsed.data.updatedAt),
    };
  } catch (error) {
    if (error instanceof AtlasHttpError) throw error;
    throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Invalid search cursor.");
  }
}

function encodeSearchCursor(item: SearchResultItem) {
  return Buffer.from(
    JSON.stringify({
      id: searchResultId(item),
      type: item.type,
      updatedAt: searchResultUpdatedAt(item).toISOString(),
    }),
  ).toString("base64url");
}

function searchResultId(item: SearchResultItem) {
  return item.type === "project" ? item.project.id : item.task.id;
}

function searchResultUpdatedAt(item: SearchResultItem) {
  return item.type === "project" ? item.project.updatedAt : item.task.updatedAt;
}

function searchResultRank(type: SearchResultType) {
  return searchResultTypeRank[type] ?? 0;
}

function notificationPreferenceResponse(input: {
  emailEnabled: boolean;
  updatedAt: Date | null;
  userId: string;
  workspaceId: string;
}) {
  return {
    emailEnabled: input.emailEnabled,
    inAppEnabled: true as const,
    updatedAt: input.updatedAt?.toISOString() ?? null,
    userId: input.userId,
    workspaceId: input.workspaceId,
  };
}
