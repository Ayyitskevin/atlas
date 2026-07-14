import type { TaskPriority, TaskRecurrenceFrequency, TaskStatus } from "@atlas/db";
import type {
  MyWorkDependencyFilter,
  MyWorkDueFilter,
  MyWorkScopeFilter,
  MyWorkStatusFilter,
  ProjectTaskQuery,
} from "@atlas/shared";

import { paginationArgs } from "../../shared/pagination.js";
import {
  myWorkDependencyWhere,
  myWorkDueDateWhere,
  myWorkScopeWhere,
  myWorkStatusWhere,
  taskDependencyWhere,
} from "../work/my-work-filters.js";
import { completedAtForStatusTransition } from "../work/task-state.js";
import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class TasksRepository extends WorkRepositoryBase {
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
    return this.prisma.task.create({
      data: {
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        position: input.position,
        priority: input.priority,
        projectId: input.projectId,
        recurrenceEndDate: input.recurrenceFrequency && input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : undefined,
        recurrenceFrequency: input.recurrenceFrequency ?? undefined,
        recurrenceInterval: input.recurrenceFrequency ? input.recurrenceInterval ?? 1 : undefined,
        sectionId: input.sectionId,
        title: input.title,
        workspaceId: input.workspaceId,
        assignees: {
          create: input.assigneeIds.map((userId) => ({ userId, workspaceId: input.workspaceId })),
        },
      },
      include: { assignees: true },
    });
  }

  listTasks(input: ProjectTaskQuery & { projectId: string; workspaceId: string }) {
    return this.prisma.task.findMany({
      ...paginationArgs(input),
      include: { assignees: true },
      orderBy: [{ sectionId: "asc" }, { position: "asc" }],
      where: {
        AND: [taskDependencyWhere(input.dependency, input.workspaceId)],
        deletedAt: null,
        projectId: input.projectId,
        workspaceId: input.workspaceId,
      },
    });
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
    return this.prisma.task.findMany({
      ...paginationArgs(input),
      include: {
        assignees: true,
        project: { select: { id: true, name: true, visibility: true } },
      },
      orderBy: [{ dueDate: { nulls: "last", sort: "asc" } }, { updatedAt: "desc" }, { id: "asc" }],
      where: {
        AND: [
          myWorkStatusWhere(input.status),
          myWorkDueDateWhere(input.due),
          myWorkScopeWhere(input.scope, input.userId, input.workspaceId),
          myWorkDependencyWhere(input.dependency, input.workspaceId),
        ],
        deletedAt: null,
        project: this.accessibleProjectWhere(input.userId, input.workspaceId),
        workspaceId: input.workspaceId,
      },
    });
  }

  findTask(workspaceId: string, taskId: string) {
    return this.prisma.task.findFirst({
      include: { assignees: true, comments: { where: { deletedAt: null }, take: 5 } },
      where: { deletedAt: null, id: taskId, workspaceId },
    });
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
    const result = await this.prisma.task.updateMany({
      data: {
        ...input.data,
        dueDate: input.data.dueDate === undefined ? undefined : input.data.dueDate === null ? null : new Date(input.data.dueDate),
        recurrenceEndDate:
          input.data.recurrenceEndDate === undefined
            ? undefined
            : input.data.recurrenceEndDate === null
              ? null
              : new Date(input.data.recurrenceEndDate),
        completedAt: completedAtForStatusTransition(input.data.status, new Date()),
        version: { increment: 1 },
      },
      where: { deletedAt: null, id: input.taskId, version: input.version, workspaceId: input.workspaceId },
    });
    return result.count;
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
    return this.prisma.task.create({
      data: {
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position: input.position,
        priority: input.priority,
        projectId: input.projectId,
        recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : null,
        recurrenceFrequency: input.recurrenceFrequency,
        recurrenceGeneratedFromTaskId: input.generatedFromTaskId,
        recurrenceInterval: input.recurrenceInterval,
        sectionId: input.sectionId,
        title: input.title,
        workspaceId: input.workspaceId,
        assignees: {
          create: input.assigneeIds.map((userId) => ({ userId, workspaceId: input.workspaceId })),
        },
      },
      include: { assignees: true },
    });
  }

  async moveTask(input: { position: number; sectionId: string; taskId: string; version: number; workspaceId: string }) {
    const result = await this.prisma.task.updateMany({
      data: { position: input.position, sectionId: input.sectionId, version: { increment: 1 } },
      where: { deletedAt: null, id: input.taskId, version: input.version, workspaceId: input.workspaceId },
    });
    return result.count;
  }

  softDeleteTask(workspaceId: string, taskId: string) {
    return this.prisma.task.updateMany({ data: { deletedAt: new Date() }, where: { id: taskId, workspaceId } });
  }

  assignTask(input: { assignedById: string; taskId: string; userId: string; workspaceId: string }) {
    return this.prisma.taskAssignee.upsert({
      create: input,
      update: {},
      where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
    });
  }

  unassignTask(input: { taskId: string; userId: string; workspaceId: string }) {
    return this.prisma.taskAssignee.deleteMany({
      where: { taskId: input.taskId, userId: input.userId, workspaceId: input.workspaceId },
    });
  }

  listTaskWatchers(input: { taskId: string; workspaceId: string }) {
    return this.prisma.taskWatcher.findMany({
      include: { user: { select: { email: true, id: true, name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  watchTask(input: { taskId: string; userId: string; watchedById: string; workspaceId: string }) {
    return this.prisma.taskWatcher.upsert({
      create: input,
      include: { user: { select: { email: true, id: true, name: true } } },
      update: { watchedById: input.watchedById },
      where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
    });
  }

  unwatchTask(input: { taskId: string; userId: string; workspaceId: string }) {
    return this.prisma.taskWatcher.deleteMany({
      where: { taskId: input.taskId, userId: input.userId, workspaceId: input.workspaceId },
    });
  }

  countWorkspaceMembers(input: { userIds: string[]; workspaceId: string }) {
    const userIds = [...new Set(input.userIds)];
    if (!userIds.length) return Promise.resolve(0);
    return this.prisma.workspaceMember.count({
      where: {
        deletedAt: null,
        user: { deletedAt: null, disabledAt: null },
        userId: { in: userIds },
        workspaceId: input.workspaceId,
      },
    });
  }
}
