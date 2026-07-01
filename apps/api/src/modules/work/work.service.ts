import {
  ATLAS_ERROR_CODES,
  type ActivityQuery,
  type CreateAttachmentRequest,
  type CreateCommentRequest,
  type CreateSectionRequest,
  type CreateSubtaskRequest,
  type CreateTaskRequest,
  type CursorPaginationQuery,
  type MoveTaskRequest,
  type MyWorkQuery,
  type NotificationQuery,
  type ReorderSectionsRequest,
  type SearchQuery,
  type UpdateCommentRequest,
  type UpdateSectionRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
} from "@atlas/shared";

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
    return section;
  }

  async deleteSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const count = await this.workRepository.softDeleteSection({ projectId, sectionId, workspaceId });
    if (!count) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Section not found in this Project.");
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
      payload: { title: task.title },
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
    const eventType = input.status === "DONE" && task.status !== "DONE" ? "TaskCompleted" : "TaskUpdated";
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType,
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
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskMoved",
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    return this.workRepository.findTask(workspaceId, taskId);
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

  async completeTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (task.status === "DONE") return task;
    return this.updateTask(ctx, workspaceId, taskId, { status: "DONE", version: task.version });
  }

  async createSubtask(ctx: AuthContext, workspaceId: string, taskId: string, input: CreateSubtaskRequest) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "EDITOR");
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
    await this.permissions.requireTaskRole(ctx, workspaceId, subtask.taskId, "EDITOR");
    if (input.assigneeId) await this.requireWorkspaceMembers(workspaceId, [input.assigneeId]);
    const count = await this.workRepository.updateSubtask({
      data: { assigneeId: input.assigneeId, status: input.status, title: input.title },
      subtaskId,
      version: input.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Subtask has changed since it was loaded.");
    return this.workRepository.findSubtask(workspaceId, subtaskId);
  }

  async deleteSubtask(ctx: AuthContext, workspaceId: string, subtaskId: string) {
    const subtask = await this.workRepository.findSubtask(workspaceId, subtaskId);
    if (!subtask) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Subtask not found.");
    await this.permissions.requireTaskRole(ctx, workspaceId, subtask.taskId, "EDITOR");
    await this.workRepository.softDeleteSubtask(workspaceId, subtaskId);
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
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    return this.workRepository.updateComment(commentId, input.body);
  }

  async deleteComment(ctx: AuthContext, workspaceId: string, commentId: string) {
    const comment = await this.workRepository.findComment(workspaceId, commentId);
    if (!comment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Comment not found.");
    if (comment.authorId !== ctx.userId) await this.permissions.requireTaskRole(ctx, workspaceId, comment.taskId, "EDITOR");
    await this.workRepository.softDeleteComment(commentId);
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
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    await this.workRepository.softDeleteAttachment({ attachmentId, workspaceId });
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
    const [tasks, projects] = await this.workRepository.searchWorkspace({ ...query, userId: ctx.userId, workspaceId });
    return { items: [...projects.map((project) => ({ type: "project", project })), ...tasks.map((task) => ({ type: "task", task }))] };
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
