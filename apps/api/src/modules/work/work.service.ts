import {
  ATLAS_ERROR_CODES,
  type ActivityQuery,
  type AddTaskDependencyRequest,
  type CreateAttachmentRequest,
  type CreateCommentRequest,
  type CreateSectionRequest,
  type CreateSubtaskRequest,
  type CreateTaskLabelRequest,
  type CreateTaskRequest,
  type CursorPaginationQuery,
  type MoveTaskRequest,
  type MyWorkQuery,
  type ProjectTaskQuery,
  type NotificationQuery,
  type ReplaceAttachmentRequest,
  type UpdateNotificationPreferenceRequest,
  type ReorderSectionsRequest,
  searchCursorSchema,
  type SearchQuery,
  type SearchResultType,
  type UpdateAttachmentRequest,
  type UpdateCommentRequest,
  type UpdateTaskLabelRequest,
  type UpdateSectionRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
} from "@atlas/shared";
import { Prisma, type TaskPriority, type TaskRecurrenceFrequency, type TaskStatus } from "@atlas/db";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { createAttachmentObjectKey, createDownloadInstructions, createUploadInstructions, getAttachmentObjectMetadata } from "../../storage/object-storage.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { defaultListPosition } from "./position.js";
import { wouldCreateDependencyCycle } from "./task-dependencies.js";
import { nextRecurringDueDate } from "./task-recurrence.js";
import { WorkRepository } from "./work.repository.js";

type TaskDependencySummary = {
  blockedByOpenCount: number;
  blocksCount: number;
  isBlocked: boolean;
};

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
    const recurrence = this.createRecurrence(input);
    const task = await this.workRepository.createTask({
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
    const tasks = await this.workRepository.listTasks({ ...query, projectId, workspaceId });
    return pageFromLimit(await this.withDependencySummaries(workspaceId, tasks), query.limit);
  }

  async listMyWork(ctx: AuthContext, workspaceId: string, query: MyWorkQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return pageFromLimit(
      await this.withDependencySummaries(
        workspaceId,
        await this.workRepository.listMyWork({ ...query, userId: ctx.userId, workspaceId }),
      ),
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
    if (input.status === "DONE" && task.status !== "DONE") await this.requireTaskNotBlocked(workspaceId, taskId);
    const recurrence = this.updateRecurrence(input, task, new Date());
    const count = await this.workRepository.updateTask({
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
    const updated = await this.workRepository.findTask(workspaceId, taskId);
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

  async listTaskDependencies(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    const rows = await this.workRepository.listTaskDependencies({ taskId, workspaceId });
    const summaries = await this.dependencySummaryMap(
      workspaceId,
      rows.flatMap((row) => [row.blockedTaskId, row.blockingTaskId]),
    );
    const blockedBy = rows
      .filter((row) => row.blockedTaskId === taskId)
      .map((row) => dependencyEdgeView(row, row.blockingTask, summaries.get(row.blockingTaskId)));
    const blocks = rows
      .filter((row) => row.blockingTaskId === taskId)
      .map((row) => dependencyEdgeView(row, row.blockedTask, summaries.get(row.blockedTaskId)));
    const isBlocked = blockedBy.some((edge) => edge.task.status !== "DONE");
    return { blockedBy, blocks, isBlocked };
  }

  async listProjectDependencyMap(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    const rows = await this.workRepository.listProjectDependencyMapRows({ projectId, workspaceId });
    const nodeIds = rows.flatMap((row) => [row.blockedTaskId, row.blockingTaskId]);
    const summaries = await this.dependencySummaryMap(workspaceId, nodeIds);
    const nodes = uniqueDependencyMapNodes(rows, summaries);
    const edges = rows.map((row) => ({
      blockedTaskId: row.blockedTaskId,
      blockingTaskId: row.blockingTaskId,
      createdAt: dateTimePayloadValue(row.createdAt),
      id: row.id,
    }));
    return {
      criticalPathTaskIds: longestOpenDependencyChain(nodes, edges),
      edges,
      nodes,
      stats: dependencyMapStats(nodes, edges),
    };
  }

  async addTaskDependency(ctx: AuthContext, workspaceId: string, taskId: string, input: AddTaskDependencyRequest) {
    const blockedTask = await this.getTask(ctx, workspaceId, taskId);
    await this.permissions.requireProjectRole(ctx, workspaceId, blockedTask.projectId, "EDITOR");
    if (input.blockingTaskId === taskId) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "A task cannot depend on itself.");
    }
    const blockingTask = await this.workRepository.findTask(workspaceId, input.blockingTaskId);
    if (!blockingTask) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Blocking task not found in this Workspace.");
    if (blockingTask.projectId !== blockedTask.projectId) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Task dependencies must be within the same Project.");
    }
    const existing = await this.workRepository.findTaskDependencyByPair({
      blockedTaskId: taskId,
      blockingTaskId: input.blockingTaskId,
      workspaceId,
    });
    if (existing) return existing;
    const edges = await this.workRepository.listProjectDependencyEdges({ projectId: blockedTask.projectId, workspaceId });
    if (wouldCreateDependencyCycle(edges, input.blockingTaskId, taskId)) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "That dependency would create a circular dependency.");
    }
    try {
      const dependency = await this.workRepository.createTaskDependency({
        blockedTaskId: taskId,
        blockingTaskId: input.blockingTaskId,
        createdById: ctx.userId,
        workspaceId,
      });
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: dependency.id,
        entityType: "task_dependency",
        eventType: "TaskDependencyAdded",
        payload: {
          blockedTaskId: taskId,
          blockedTaskTitle: blockedTask.title,
          blockingTaskId: input.blockingTaskId,
          blockingTaskTitle: blockingTask.title,
        },
        projectId: blockedTask.projectId,
        taskId,
        workspaceId,
      });
      return dependency;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        const created = await this.workRepository.findTaskDependencyByPair({
          blockedTaskId: taskId,
          blockingTaskId: input.blockingTaskId,
          workspaceId,
        });
        if (created) return created;
      }
      throw error;
    }
  }

  async removeTaskDependency(ctx: AuthContext, workspaceId: string, dependencyId: string) {
    const dependency = await this.workRepository.findTaskDependency({ dependencyId, workspaceId });
    if (!dependency) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task dependency not found.");
    await this.permissions.requireProjectRole(ctx, workspaceId, dependency.blockedTask.projectId, "EDITOR");
    const result = await this.workRepository.deleteTaskDependency({ dependencyId, workspaceId });
    if (!result.count) return { ok: true };
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: dependencyId,
      entityType: "task_dependency",
      eventType: "TaskDependencyRemoved",
      payload: {
        blockedTaskId: dependency.blockedTaskId,
        blockedTaskTitle: dependency.blockedTask.title,
        blockingTaskId: dependency.blockingTaskId,
        blockingTaskTitle: dependency.blockingTask.title,
      },
      projectId: dependency.blockedTask.projectId,
      taskId: dependency.blockedTaskId,
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
    const count = await this.workRepository.updateTask({
      data: { recurrenceSkippedAt: now, status: "DONE" },
      taskId,
      version: task.version,
      workspaceId,
    });
    if (!count) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.STALE_VERSION, "Task has changed since it was loaded.");
    const skipped = await this.workRepository.findTask(workspaceId, taskId);
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
      description: normalizeAttachmentDescription(input.description),
      fileName: input.fileName,
      mimeType: input.mimeType,
      objectKey,
      sizeBytes: input.sizeBytes,
      taskId,
      uploadedById: ctx.userId,
      workspaceId,
    });
    return { attachment, upload: await createUploadInstructions({ mimeType: attachment.mimeType, objectKey: attachment.objectKey }) };
  }

  async completeAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string) {
    const attachment = await this.workRepository.findAttachmentIncludingPending(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    if (!attachment.activatedAt) await this.assertAttachmentObjectMatches({ mimeType: attachment.mimeType, objectKey: attachment.objectKey, sizeBytes: attachment.sizeBytes });
    const result = await this.workRepository.completeAttachment({ attachmentId, workspaceId });
    if (result.conflict || !result.attachment) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment changed before upload completion.");
    }
    if (result.activated) {
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: attachment.id,
        entityType: "attachment",
        eventType: "AttachmentAdded",
        payload: { attachmentId: attachment.id, description: attachment.description, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
        projectId: task.projectId,
        taskId: attachment.taskId,
        workspaceId,
      });
    }
    return result.attachment;
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

  async createAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, input: ReplaceAttachmentRequest) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const objectKey = createAttachmentObjectKey({ fileName: input.fileName, taskId: attachment.taskId, workspaceId });
    try {
      const version = await this.workRepository.prepareAttachmentVersion({
        attachmentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        objectKey,
        sizeBytes: input.sizeBytes,
        uploadedById: ctx.userId,
        version: attachment.version + 1,
        workspaceId,
      });
      return {
        attachment,
        upload: await createUploadInstructions({ mimeType: version.mimeType, objectKey: version.objectKey }),
        version,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment replacement is already pending.");
      }
      throw error;
    }
  }

  async completeAttachmentVersion(ctx: AuthContext, workspaceId: string, attachmentId: string, versionId: string) {
    const version = await this.workRepository.findAttachmentVersion({ attachmentId, versionId, workspaceId });
    if (!version || version.attachment.deletedAt) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment version not found.");
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = version.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    if (!version.activatedAt) await this.assertAttachmentObjectMatches({ mimeType: version.mimeType, objectKey: version.objectKey, sizeBytes: version.sizeBytes });
    const result = await this.workRepository.completeAttachmentVersion({ attachmentId, versionId, workspaceId });
    if (result.conflict || !result.attachment || !result.version) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment changed before this version was completed.");
    }
    if (result.activated) {
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: attachmentId,
        entityType: "attachment",
        eventType: "AttachmentReplaced",
        payload: {
          attachmentId,
          fileName: result.attachment.fileName,
          previousFileName: attachment.fileName,
          previousSizeBytes: attachment.sizeBytes,
          sizeBytes: result.attachment.sizeBytes,
          version: result.attachment.version,
          versionId,
        },
        projectId: task.projectId,
        taskId: attachment.taskId,
        workspaceId,
      });
    }
    return result.attachment;
  }

  private async assertAttachmentObjectMatches(input: { mimeType: string; objectKey: string; sizeBytes: number }) {
    const metadata = await getAttachmentObjectMetadata(input.objectKey);
    if (!metadata) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Attachment upload has not finished.", {
        objectKey: input.objectKey,
        reason: "missing",
      });
    }

    if (metadata.contentLength !== input.sizeBytes) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Uploaded attachment size does not match the requested file.", {
        actualSizeBytes: metadata.contentLength,
        expectedSizeBytes: input.sizeBytes,
        objectKey: input.objectKey,
        reason: "size_mismatch",
      });
    }

    if (normalizeMimeType(metadata.contentType) !== normalizeMimeType(input.mimeType)) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Uploaded attachment type does not match the requested file.", {
        actualMimeType: metadata.contentType,
        expectedMimeType: input.mimeType,
        objectKey: input.objectKey,
        reason: "mime_type_mismatch",
      });
    }
  }

  async updateAttachment(ctx: AuthContext, workspaceId: string, attachmentId: string, input: UpdateAttachmentRequest) {
    const attachment = await this.workRepository.findAttachment(workspaceId, attachmentId);
    if (!attachment) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    const task = await this.getTask(ctx, workspaceId, attachment.taskId);
    const requiredRole = attachment.uploadedById === ctx.userId ? "COMMENTER" : "EDITOR";
    await this.permissions.requireTaskRole(ctx, workspaceId, attachment.taskId, requiredRole);
    const description = normalizeAttachmentDescription(input.description);
    const updated = await this.workRepository.updateAttachment({ attachmentId, description, workspaceId });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Attachment not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: attachmentId,
      entityType: "attachment",
      eventType: "AttachmentUpdated",
      payload: { attachmentId, description, fileName: attachment.fileName, sizeBytes: attachment.sizeBytes },
      projectId: task.projectId,
      taskId: attachment.taskId,
      workspaceId,
    });
    return updated;
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

  private async withDependencySummaries<TTask extends { id: string }>(workspaceId: string, tasks: TTask[]) {
    const summaries = await this.dependencySummaryMap(
      workspaceId,
      tasks.map((task) => task.id),
    );

    return tasks.map((task) => ({
      ...task,
      dependencySummary: summaries.get(task.id) ?? emptyDependencySummary(),
    }));
  }

  private async dependencySummaryMap(workspaceId: string, taskIds: string[]) {
    const summaries = new Map<string, TaskDependencySummary>();
    const ids = [...new Set(taskIds)];
    for (const taskId of ids) summaries.set(taskId, emptyDependencySummary());

    const rows = await this.workRepository.listTaskDependencySummaryRows({
      taskIds: ids,
      workspaceId,
    });

    for (const row of rows) {
      const blocked = summaries.get(row.blockedTaskId);
      if (blocked && row.blockingTask.status !== "DONE") {
        blocked.blockedByOpenCount += 1;
        blocked.isBlocked = true;
      }

      const blocking = summaries.get(row.blockingTaskId);
      if (blocking) blocking.blocksCount += 1;
    }

    return summaries;
  }

  private async requireTaskNotBlocked(workspaceId: string, taskId: string) {
    const rows = await this.workRepository.listTaskDependencySummaryRows({ taskIds: [taskId], workspaceId });
    const openBlockerCount = rows.filter((row) => row.blockedTaskId === taskId && row.blockingTask.status !== "DONE").length;
    if (openBlockerCount) {
      throw new AtlasHttpError(
        409,
        ATLAS_ERROR_CODES.CONFLICT,
        "Complete open blocking tasks before completing this task.",
        { openBlockerCount },
      );
    }
  }

  private async recordTasksUnblockedByCompletion(
    ctx: AuthContext,
    workspaceId: string,
    blockingTask: { id: string; title: string },
  ) {
    const rows = await this.workRepository.listTasksUnblockedByCompletion({
      blockingTaskId: blockingTask.id,
      workspaceId,
    });
    const unblockedRows = rows.filter((row) => row.blockedTask.dependenciesAsBlocked.length === 0);

    await Promise.all(
      unblockedRows.map((row) =>
        this.events.recordActivity({
          actorUserId: ctx.userId,
          entityId: row.id,
          entityType: "task_dependency",
          eventType: "TaskDependencyUnblocked",
          payload: {
            blockedTaskId: row.blockedTaskId,
            blockedTaskTitle: row.blockedTask.title,
            blockingTaskId: blockingTask.id,
            blockingTaskTitle: blockingTask.title,
          },
          projectId: row.blockedTask.projectId,
          taskId: row.blockedTaskId,
          workspaceId,
        }),
      ),
    );
  }

  private createRecurrence(input: CreateTaskRequest) {
    if ((input.recurrenceInterval !== undefined || input.recurrenceEndDate !== undefined) && !input.recurrenceFrequency) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
    }
    return {
      recurrenceEndDate: input.recurrenceFrequency ? input.recurrenceEndDate ?? null : null,
      recurrenceFrequency: input.recurrenceFrequency ?? null,
      recurrenceInterval: input.recurrenceFrequency ? input.recurrenceInterval ?? 1 : null,
    };
  }

  private updateRecurrence(
    input: UpdateTaskRequest,
    task: {
      recurrenceEndDate?: Date | string | null;
      recurrenceFrequency?: TaskRecurrenceFrequency | null;
      recurrenceInterval?: number | null;
      recurrencePausedAt?: Date | string | null;
    },
    now: Date,
  ) {
    if (input.recurrenceFrequency === null) {
      return { recurrenceEndDate: null, recurrenceFrequency: null, recurrenceInterval: null, recurrencePausedAt: null };
    }
    const recurrence = {
      recurrenceEndDate: datePayloadValue(task.recurrenceEndDate),
      recurrenceFrequency: task.recurrenceFrequency ?? null,
      recurrenceInterval: task.recurrenceInterval ?? null,
      recurrencePausedAt: dateTimeOrNull(task.recurrencePausedAt),
    };
    if (input.recurrenceFrequency !== undefined) {
      recurrence.recurrenceFrequency = input.recurrenceFrequency;
      recurrence.recurrenceInterval = input.recurrenceInterval ?? task.recurrenceInterval ?? 1;
    }
    if (input.recurrenceInterval === null) {
      return { recurrenceEndDate: null, recurrenceFrequency: null, recurrenceInterval: null, recurrencePausedAt: null };
    }
    if (input.recurrenceInterval !== undefined && input.recurrenceFrequency === undefined) {
      if (!recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
      }
      recurrence.recurrenceInterval = input.recurrenceInterval;
    }
    if (input.recurrenceEndDate !== undefined) {
      if (input.recurrenceEndDate !== null && !recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Recurring tasks require a recurrence frequency.");
      }
      recurrence.recurrenceEndDate = input.recurrenceEndDate;
    }
    if (input.recurrencePaused === true) {
      if (!recurrence.recurrenceFrequency) {
        throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Only recurring tasks can be paused.");
      }
      recurrence.recurrencePausedAt = recurrence.recurrencePausedAt ?? now;
    }
    if (input.recurrencePaused === false) {
      recurrence.recurrencePausedAt = null;
    }
    if (!recurrence.recurrenceFrequency) {
      recurrence.recurrenceEndDate = null;
      recurrence.recurrenceInterval = null;
      recurrence.recurrencePausedAt = null;
    }
    if (
      input.recurrenceEndDate !== undefined ||
      input.recurrenceFrequency !== undefined ||
      input.recurrenceInterval !== undefined ||
      input.recurrencePaused !== undefined
    ) {
      return recurrence;
    }
    return {};
  }

  private async createNextRecurringTask(
    ctx: AuthContext,
    workspaceId: string,
    task: {
      assignees: Array<{ userId: string }>;
      description?: string | null;
      dueDate?: Date | string | null;
      id: string;
      priority: TaskPriority;
      projectId: string;
      recurrenceEndDate?: Date | string | null;
      recurrenceFrequency?: TaskRecurrenceFrequency | null;
      recurrenceInterval?: number | null;
      recurrencePausedAt?: Date | string | null;
      sectionId: string;
      title: string;
    },
  ) {
    if (!task.recurrenceFrequency || !task.recurrenceInterval || task.recurrencePausedAt) return null;
    const nextDueDate = nextRecurringDueDate({
      dueDate: task.dueDate,
      frequency: task.recurrenceFrequency,
      interval: task.recurrenceInterval,
    });
    const recurrenceEndDate = datePayloadValue(task.recurrenceEndDate);
    if (recurrenceEndDate && nextDueDate > recurrenceEndDate) return null;
    try {
      const nextTask = await this.workRepository.createRecurringTask({
        assigneeIds: task.assignees.map((assignee) => assignee.userId),
        description: task.description,
        dueDate: nextDueDate,
        generatedFromTaskId: task.id,
        position: defaultListPosition(),
        priority: task.priority,
        projectId: task.projectId,
        recurrenceEndDate,
        recurrenceFrequency: task.recurrenceFrequency,
        recurrenceInterval: task.recurrenceInterval,
        sectionId: task.sectionId,
        title: task.title,
        workspaceId,
      });
      await this.events.recordActivity({
        actorUserId: ctx.userId,
        entityId: nextTask.id,
        entityType: "task",
        eventType: "TaskRecurrenceGenerated",
        payload: { ...taskAuditPayload(nextTask), generatedFromTaskId: task.id },
        projectId: task.projectId,
        taskId: nextTask.id,
        workspaceId,
      });
      return nextTask;
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) return null;
      throw error;
    }
  }
}

function taskAuditPayload(
  task: {
    dueDate?: Date | string | null;
    priority: string;
    recurrenceEndDate?: Date | string | null;
    recurrenceFrequency?: string | null;
    recurrenceInterval?: number | null;
    recurrencePausedAt?: Date | string | null;
    recurrenceSkippedAt?: Date | string | null;
    sectionId: string;
    status: string;
    title: string;
  },
  previous?: {
    dueDate?: Date | string | null;
    priority: string;
    recurrenceEndDate?: Date | string | null;
    recurrenceFrequency?: string | null;
    recurrenceInterval?: number | null;
    recurrencePausedAt?: Date | string | null;
    recurrenceSkippedAt?: Date | string | null;
    status: string;
    title: string;
  },
) {
  const payload: Record<string, number | string | null> = {
    dueDate: datePayloadValue(task.dueDate),
    priority: task.priority,
    recurrenceEndDate: datePayloadValue(task.recurrenceEndDate),
    recurrenceFrequency: task.recurrenceFrequency ?? null,
    recurrenceInterval: task.recurrenceInterval ?? null,
    recurrencePausedAt: dateTimePayloadValue(task.recurrencePausedAt),
    recurrenceSkippedAt: dateTimePayloadValue(task.recurrenceSkippedAt),
    sectionId: task.sectionId,
    status: task.status,
    title: task.title,
  };
  if (!previous) return payload;
  if (previous.title !== task.title) payload.previousTitle = previous.title;
  if (previous.status !== task.status) payload.previousStatus = previous.status;
  if (previous.priority !== task.priority) payload.previousPriority = previous.priority;
  if ((previous.recurrenceFrequency ?? null) !== (task.recurrenceFrequency ?? null)) {
    payload.previousRecurrenceFrequency = previous.recurrenceFrequency ?? null;
  }
  if ((previous.recurrenceInterval ?? null) !== (task.recurrenceInterval ?? null)) {
    payload.previousRecurrenceInterval = previous.recurrenceInterval ?? null;
  }
  const previousRecurrenceEndDate = datePayloadValue(previous.recurrenceEndDate);
  if (previousRecurrenceEndDate !== payload.recurrenceEndDate) {
    payload.previousRecurrenceEndDate = previousRecurrenceEndDate;
  }
  const previousRecurrencePausedAt = dateTimePayloadValue(previous.recurrencePausedAt);
  if (previousRecurrencePausedAt !== payload.recurrencePausedAt) {
    payload.previousRecurrencePausedAt = previousRecurrencePausedAt;
  }
  const previousRecurrenceSkippedAt = dateTimePayloadValue(previous.recurrenceSkippedAt);
  if (previousRecurrenceSkippedAt !== payload.recurrenceSkippedAt) {
    payload.previousRecurrenceSkippedAt = previousRecurrenceSkippedAt;
  }
  const previousDueDate = datePayloadValue(previous.dueDate);
  if (previousDueDate !== payload.dueDate) payload.previousDueDate = previousDueDate;
  return payload;
}

function recurrencePauseEventType(
  previous: { recurrencePausedAt?: Date | string | null },
  task: { recurrencePausedAt?: Date | string | null },
): "TaskRecurrencePaused" | "TaskRecurrenceResumed" | null {
  const wasPaused = Boolean(previous.recurrencePausedAt);
  const isPaused = Boolean(task.recurrencePausedAt);
  if (!wasPaused && isPaused) return "TaskRecurrencePaused";
  if (wasPaused && !isPaused) return "TaskRecurrenceResumed";
  return null;
}

function datePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function dateTimePayloadValue(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function dateTimeOrNull(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function dependencyEdgeView(
  row: { blockedTaskId: string; blockingTaskId: string; createdAt: Date; id: string },
  task: {
    _count?: { assignees: number };
    dueDate?: Date | string | null;
    id: string;
    priority?: string;
    status: string;
    title: string;
  },
  dependencySummary?: TaskDependencySummary,
) {
  return {
    blockedTaskId: row.blockedTaskId,
    blockingTaskId: row.blockingTaskId,
    createdAt: row.createdAt,
    id: row.id,
    task: {
      assigneeCount: task._count?.assignees ?? 0,
      dependencySummary: dependencySummary ?? emptyDependencySummary(),
      dueDate: datePayloadValue(task.dueDate),
      id: task.id,
      priority: task.priority,
      status: task.status,
      title: task.title,
    },
  };
}

type ProjectDependencyMapTask = {
  dueDate?: Date | string | null;
  id: string;
  priority: TaskPriority;
  sectionId: string;
  status: TaskStatus;
  title: string;
};

type ProjectDependencyMapNode = ReturnType<typeof projectDependencyMapNodeView>;

type ProjectDependencyMapEdge = {
  blockedTaskId: string;
  blockingTaskId: string;
};

function uniqueDependencyMapNodes(
  rows: Array<{ blockedTask: ProjectDependencyMapTask; blockedTaskId: string; blockingTask: ProjectDependencyMapTask; blockingTaskId: string }>,
  summaries: Map<string, TaskDependencySummary>,
) {
  const nodes = new Map<string, ProjectDependencyMapNode>();
  for (const row of rows) {
    nodes.set(row.blockingTaskId, projectDependencyMapNodeView(row.blockingTask, summaries.get(row.blockingTaskId)));
    nodes.set(row.blockedTaskId, projectDependencyMapNodeView(row.blockedTask, summaries.get(row.blockedTaskId)));
  }
  return [...nodes.values()].sort(compareDependencyMapNodes);
}

function projectDependencyMapNodeView(task: ProjectDependencyMapTask, dependencySummary?: TaskDependencySummary) {
  return {
    dependencySummary: dependencySummary ?? emptyDependencySummary(),
    dueDate: datePayloadValue(task.dueDate),
    id: task.id,
    priority: task.priority,
    sectionId: task.sectionId,
    status: task.status,
    title: task.title,
  };
}

function dependencyMapStats(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  return {
    blockedTaskCount: nodes.filter((node) => node.dependencySummary.isBlocked).length,
    blockingTaskCount: nodes.filter((node) => node.dependencySummary.blocksCount > 0).length,
    edgeCount: edges.length,
    openEdgeCount: openDependencyEdges(nodes, edges).length,
    readyBlockerCount: nodes.filter((node) => node.status !== "DONE" && node.dependencySummary.blocksCount > 0 && node.dependencySummary.blockedByOpenCount === 0).length,
  };
}

function longestOpenDependencyChain(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of openDependencyEdges(nodes, edges)) {
    const blocked = outgoing.get(edge.blockingTaskId) ?? [];
    blocked.push(edge.blockedTaskId);
    outgoing.set(edge.blockingTaskId, blocked);
  }
  for (const blocked of outgoing.values()) blocked.sort((left, right) => compareDependencyMapNodes(nodesById.get(left), nodesById.get(right)));

  const memo = new Map<string, string[]>();
  const visiting = new Set<string>();
  const bestFrom = (taskId: string): string[] => {
    if (memo.has(taskId)) return memo.get(taskId) ?? [taskId];
    if (visiting.has(taskId)) return [taskId];
    visiting.add(taskId);
    let best = [taskId];
    for (const blockedTaskId of outgoing.get(taskId) ?? []) {
      const candidate = [taskId, ...bestFrom(blockedTaskId)];
      if (candidate.length > best.length) best = candidate;
    }
    visiting.delete(taskId);
    memo.set(taskId, best);
    return best;
  };

  let best: string[] = [];
  for (const node of nodes.filter((candidate) => candidate.status !== "DONE")) {
    const candidate = bestFrom(node.id);
    if (candidate.length > best.length) best = candidate;
  }
  return best.length > 1 ? best : [];
}

function openDependencyEdges(nodes: ProjectDependencyMapNode[], edges: ProjectDependencyMapEdge[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  return edges.filter((edge) => nodesById.get(edge.blockingTaskId)?.status !== "DONE" && nodesById.get(edge.blockedTaskId)?.status !== "DONE");
}

function compareDependencyMapNodes(left?: ProjectDependencyMapNode, right?: ProjectDependencyMapNode) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const due = (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
  if (due !== 0) return due;
  const title = left.title.localeCompare(right.title);
  if (title !== 0) return title;
  return left.id.localeCompare(right.id);
}

function emptyDependencySummary(): TaskDependencySummary {
  return { blockedByOpenCount: 0, blocksCount: 0, isBlocked: false };
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeAttachmentDescription(value: string | null | undefined) {
  const description = value?.trim();
  return description ? description : null;
}

function normalizeMimeType(value: string | null | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? null;
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
