import type { Prisma, PrismaClient, TaskPriority, TaskStatus } from "@atlas/db";

import { paginationArgs } from "../../shared/pagination.js";

export class WorkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createSection(input: { name: string; position: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.create({ data: input });
  }

  listSections(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.findMany({
      ...paginationArgs(input),
      orderBy: { position: "asc" },
      where: { deletedAt: null, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  updateSection(sectionId: string, input: { name?: string; position?: number }) {
    return this.prisma.section.update({ data: input, where: { id: sectionId } });
  }

  softDeleteSection(sectionId: string) {
    return this.prisma.section.update({ data: { deletedAt: new Date() }, where: { id: sectionId } });
  }

  async reorderSections(input: { sections: Array<{ id: string; position: number }>; workspaceId: string }) {
    return this.prisma.$transaction(
      input.sections.map((section) =>
        this.prisma.section.updateMany({
          data: { position: section.position },
          where: { deletedAt: null, id: section.id, workspaceId: input.workspaceId },
        }),
      ),
    );
  }

  createTask(input: {
    assigneeIds: string[];
    description?: string;
    dueDate?: string;
    position: number;
    priority: TaskPriority;
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

  listTasks(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.prisma.task.findMany({
      ...paginationArgs(input),
      include: { assignees: true },
      orderBy: [{ sectionId: "asc" }, { position: "asc" }],
      where: { deletedAt: null, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  findTask(workspaceId: string, taskId: string) {
    return this.prisma.task.findFirst({
      include: { assignees: true, comments: { where: { deletedAt: null }, take: 5 } },
      where: { deletedAt: null, id: taskId, workspaceId },
    });
  }

  async updateTask(input: {
    data: { description?: string | null; dueDate?: string | null; priority?: TaskPriority; status?: TaskStatus; title?: string };
    taskId: string;
    version: number;
    workspaceId: string;
  }) {
    const result = await this.prisma.task.updateMany({
      data: {
        ...input.data,
        dueDate: input.data.dueDate === undefined ? undefined : input.data.dueDate === null ? null : new Date(input.data.dueDate),
        completedAt: input.data.status === "DONE" ? new Date() : undefined,
        version: { increment: 1 },
      },
      where: { deletedAt: null, id: input.taskId, version: input.version, workspaceId: input.workspaceId },
    });
    return result.count;
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

  createSubtask(input: { assigneeId?: string | null; position: number; taskId: string; title: string; workspaceId: string }) {
    return this.prisma.subtask.create({ data: input });
  }

  listSubtasks(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.subtask.findMany({
      ...paginationArgs(input),
      orderBy: { position: "asc" },
      where: { deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  async updateSubtask(input: {
    data: { assigneeId?: string | null; status?: TaskStatus; title?: string };
    subtaskId: string;
    version: number;
    workspaceId: string;
  }) {
    const result = await this.prisma.subtask.updateMany({
      data: {
        ...input.data,
        completedAt: input.data.status === "DONE" ? new Date() : undefined,
        version: { increment: 1 },
      },
      where: { deletedAt: null, id: input.subtaskId, version: input.version, workspaceId: input.workspaceId },
    });
    return result.count;
  }

  softDeleteSubtask(workspaceId: string, subtaskId: string) {
    return this.prisma.subtask.updateMany({ data: { deletedAt: new Date() }, where: { id: subtaskId, workspaceId } });
  }

  findSubtask(workspaceId: string, subtaskId: string) {
    return this.prisma.subtask.findFirst({ where: { deletedAt: null, id: subtaskId, workspaceId } });
  }

  createComment(input: { authorId: string; body: string; taskId: string; workspaceId: string }) {
    return this.prisma.comment.create({ data: input });
  }

  listComments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.comment.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "asc" },
      where: { deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  findComment(workspaceId: string, commentId: string) {
    return this.prisma.comment.findFirst({ where: { deletedAt: null, id: commentId, workspaceId } });
  }

  updateComment(commentId: string, body: string) {
    return this.prisma.comment.update({ data: { body, editedAt: new Date() }, where: { id: commentId } });
  }

  softDeleteComment(commentId: string) {
    return this.prisma.comment.update({ data: { deletedAt: new Date() }, where: { id: commentId } });
  }

  listActivity(input: { cursor?: string; limit: number; projectId?: string; taskId?: string; workspaceId: string }) {
    return this.prisma.activityEvent.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
    });
  }

  listNotifications(input: { cursor?: string; limit: number; recipientId: string; unreadOnly?: boolean; workspaceId: string }) {
    return this.prisma.notification.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        recipientId: input.recipientId,
        status: input.unreadOnly ? "UNREAD" : undefined,
        workspaceId: input.workspaceId,
      },
    });
  }

  markNotificationRead(input: { notificationId: string; recipientId: string; workspaceId: string }) {
    return this.prisma.notification.updateMany({
      data: { readAt: new Date(), status: "READ" },
      where: { id: input.notificationId, recipientId: input.recipientId, workspaceId: input.workspaceId },
    });
  }

  markAllNotificationsRead(input: { recipientId: string; workspaceId: string }) {
    return this.prisma.notification.updateMany({
      data: { readAt: new Date(), status: "READ" },
      where: { recipientId: input.recipientId, status: "UNREAD", workspaceId: input.workspaceId },
    });
  }

  searchWorkspace(input: { limit: number; q: string; type?: string; workspaceId: string }) {
    const tasks = input.type && !input.type.includes("task") ? [] : this.prisma.task.findMany({
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      where: {
        deletedAt: null,
        workspaceId: input.workspaceId,
        OR: [{ title: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }],
      },
    });
    const projects = input.type && !input.type.includes("project") ? [] : this.prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: input.limit,
      where: {
        deletedAt: null,
        workspaceId: input.workspaceId,
        OR: [{ name: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }],
      },
    });
    return Promise.all([tasks, projects]);
  }

  recordActivity(input: {
    actorUserId: string;
    entityId: string;
    entityType: string;
    eventType: string;
    payload?: Prisma.InputJsonValue;
    projectId?: string;
    taskId?: string;
    workspaceId: string;
  }) {
    return this.prisma.activityEvent.create({
      data: {
        actorUserId: input.actorUserId,
        entityId: input.entityId,
        entityType: input.entityType,
        eventType: input.eventType,
        payload: input.payload ?? {},
        projectId: input.projectId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
    });
  }
}
