import {
  ATLAS_ERROR_CODES,
  type ActivityQuery,
  type CreateCommentRequest,
  type CreateSectionRequest,
  type CreateSubtaskRequest,
  type CreateTaskRequest,
  type CursorPaginationQuery,
  type MoveTaskRequest,
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
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkRepository } from "./work.repository.js";

export class WorkService {
  constructor(
    private readonly workRepository: WorkRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async createSection(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateSectionRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const section = await this.workRepository.createSection({
      name: input.name,
      position: input.position ?? Date.now(),
      projectId,
      workspaceId,
    });
    await this.workRepository.recordActivity({
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
    return this.workRepository.updateSection(sectionId, input);
  }

  async deleteSection(ctx: AuthContext, workspaceId: string, projectId: string, sectionId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    return this.workRepository.softDeleteSection(sectionId);
  }

  async reorderSections(ctx: AuthContext, workspaceId: string, projectId: string, input: ReorderSectionsRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    await this.workRepository.reorderSections({ sections: input.sections, workspaceId });
    await this.workRepository.recordActivity({
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
    const task = await this.workRepository.createTask({
      ...input,
      position: input.position ?? Date.now(),
      projectId,
      workspaceId,
    });
    await this.workRepository.recordActivity({
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
    await this.workRepository.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: input.status === "DONE" ? "TaskCompleted" : "TaskUpdated",
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
    const count = await this.workRepository.moveTask({ ...input, taskId, workspaceId });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    await this.workRepository.recordActivity({
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
    const assignment = await this.workRepository.assignTask({ assignedById: ctx.userId, taskId, userId, workspaceId });
    await this.workRepository.recordActivity({
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
    await this.workRepository.recordActivity({
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
    const subtask = await this.workRepository.createSubtask({
      ...input,
      position: input.position ?? Date.now(),
      taskId,
      workspaceId,
    });
    await this.workRepository.recordActivity({
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
    await this.workRepository.recordActivity({
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

  async listActivity(ctx: AuthContext, workspaceId: string, query: ActivityQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
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
    const [tasks, projects] = await this.workRepository.searchWorkspace({ ...query, workspaceId });
    return { items: [...projects.map((project) => ({ type: "project", project })), ...tasks.map((task) => ({ type: "task", task }))] };
  }
}
