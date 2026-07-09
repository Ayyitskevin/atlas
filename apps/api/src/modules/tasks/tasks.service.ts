import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateTaskRequest,
  type MoveTaskRequest,
  type MyWorkQuery,
  type ProjectTaskQuery,
  type UpdateTaskRequest,
} from "@atlas/shared";
import { defaultListPosition } from "../work/position.js";
import {
  recurrencePauseEventType,
  taskAuditPayload,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class TasksService extends WorkDomainBase {
  async createTask(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateTaskRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    await this.requireSectionInProject(workspaceId, projectId, input.sectionId);
    await this.requireWorkspaceMembers(workspaceId, input.assigneeIds);
    const recurrence = this.createRecurrence(input);
    const task = await this.tasksRepo.createTask({
      ...input,
      position: input.position ?? defaultListPosition(),
      projectId,
      recurrenceEndDate: recurrence.recurrenceEndDate,
      recurrenceFrequency: recurrence.recurrenceFrequency,
      recurrenceInterval: recurrence.recurrenceInterval,
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


  async listTasks(ctx: AuthContext, workspaceId: string, projectId: string, query: ProjectTaskQuery) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    const tasks = await this.tasksRepo.listTasks({ ...query, projectId, workspaceId });
    return pageFromLimit(await this.withDependencySummaries(workspaceId, tasks), query.limit);
  }


  async listMyWork(ctx: AuthContext, workspaceId: string, query: MyWorkQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(
      await this.withDependencySummaries(
        workspaceId,
        await this.tasksRepo.listMyWork({ ...query, userId: ctx.userId, workspaceId }),
      ),
      query.limit,
    );
  }


  override async getTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    return super.getTask(ctx, workspaceId, taskId);
  }


  async updateTask(ctx: AuthContext, workspaceId: string, taskId: string, input: UpdateTaskRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    if (input.status === "DONE" && task.status !== "DONE") await this.requireTaskNotBlocked(workspaceId, taskId);
    const recurrence = this.updateRecurrence(input, task, new Date());
    const count = await this.tasksRepo.updateTask({
      data: {
        description: input.description,
        dueDate: input.dueDate,
        priority: input.priority,
        ...recurrence,
        status: input.status,
        title: input.title,
      },
      taskId,
      version: input.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const updated = await this.tasksRepo.findTask(workspaceId, taskId);
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    const eventType =
      updated.status === "DONE" && task.status !== "DONE"
        ? "TaskCompleted"
        : recurrencePauseEventType(task, updated) ?? "TaskUpdated";
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
    if (eventType === "TaskCompleted") {
      await this.createNextRecurringTask(ctx, workspaceId, updated);
      await this.recordTasksUnblockedByCompletion(ctx, workspaceId, updated);
    }
    return updated;
  }


  async deleteTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "EDITOR");
    await this.tasksRepo.softDeleteTask(workspaceId, taskId);
    return { ok: true };
  }


  async moveTask(ctx: AuthContext, workspaceId: string, taskId: string, input: MoveTaskRequest) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.requireSectionInProject(workspaceId, task.projectId, input.sectionId);
    const count = await this.tasksRepo.moveTask({ ...input, taskId, workspaceId });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const moved = await this.tasksRepo.findTask(workspaceId, taskId);
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
    const assignment = await this.tasksRepo.assignTask({ assignedById: ctx.userId, taskId, userId, workspaceId });
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
    await this.tasksRepo.unassignTask({ taskId, userId, workspaceId });
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
    return pageFromLimit(await this.tasksRepo.listTaskWatchers({ taskId, workspaceId }), 100);
  }


  async watchTask(ctx: AuthContext, workspaceId: string, taskId: string, userId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (userId !== ctx.userId) await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    await this.requireWorkspaceMembers(workspaceId, [userId]);
    const watcher = await this.tasksRepo.watchTask({ taskId, userId, watchedById: ctx.userId, workspaceId });
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
    const result = await this.tasksRepo.unwatchTask({ taskId, userId, workspaceId });
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


  async completeTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    if (task.status === "DONE") return task;
    return this.updateTask(ctx, workspaceId, taskId, { status: "DONE", version: task.version });
  }


  async skipRecurringTask(ctx: AuthContext, workspaceId: string, taskId: string) {
    const task = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, task.projectId, "EDITOR");
    if (!task.recurrenceFrequency || !task.recurrenceInterval) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Only recurring tasks can be skipped.");
    }
    if (task.recurrencePausedAt) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Paused recurring tasks must be resumed before they can be skipped.");
    }
    if (task.recurrenceSkippedAt) return task;
    if (task.status === "DONE") {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Completed recurring tasks cannot be skipped.");
    }

    const now = new Date();
    const count = await this.tasksRepo.updateTask({
      data: { recurrenceSkippedAt: now, status: "DONE" },
      taskId,
      version: task.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const skipped = await this.tasksRepo.findTask(workspaceId, taskId);
    if (!skipped) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: taskId,
      entityType: "task",
      eventType: "TaskRecurrenceSkipped",
      payload: taskAuditPayload(skipped, task),
      projectId: task.projectId,
      taskId,
      workspaceId,
    });
    await this.createNextRecurringTask(ctx, workspaceId, skipped);
    return skipped;
  }

}
