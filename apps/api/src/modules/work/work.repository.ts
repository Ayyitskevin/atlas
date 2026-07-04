import type { AttachmentScanStatus, Prisma, PrismaClient, TaskPriority, TaskRecurrenceFrequency, TaskStatus } from "@atlas/db";
import type { MyWorkDependencyFilter, MyWorkDueFilter, MyWorkScopeFilter, MyWorkStatusFilter, ProjectTaskQuery, SearchResultType } from "@atlas/shared";

import { paginationArgs } from "../../shared/pagination.js";
import { myWorkDependencyWhere, myWorkDueDateWhere, myWorkScopeWhere, myWorkStatusWhere, taskDependencyWhere } from "./my-work-filters.js";
import { completedAtForStatusTransition } from "./task-state.js";

const attachmentCommentVersionSelect = {
  fileName: true,
  id: true,
  sizeBytes: true,
  version: true,
};

const attachmentCommentInclude = {
  version: {
    select: attachmentCommentVersionSelect,
  },
};

const attachmentWithActiveVersions = {
  comments: {
    include: attachmentCommentInclude,
    orderBy: { createdAt: "asc" as const },
    where: { deletedAt: null },
  },
  versions: {
    orderBy: { version: "desc" as const },
    where: { activatedAt: { not: null } },
  },
};

type AttachmentScanWrite = {
  checkedAt: Date;
  message: string | null;
  provider: string;
  status: Exclude<AttachmentScanStatus, "PENDING">;
};

export class WorkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createSection(input: { name: string; position: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.create({ data: input });
  }

  findSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    return this.prisma.section.findFirst({
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  countSections(input: { projectId: string; sectionIds: string[]; workspaceId: string }) {
    const ids = [...new Set(input.sectionIds)];
    if (!ids.length) return Promise.resolve(0);
    return this.prisma.section.count({
      where: { deletedAt: null, id: { in: ids }, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  listSections(input: { cursor?: string; limit: number; projectId: string; workspaceId: string }) {
    return this.prisma.section.findMany({
      ...paginationArgs(input),
      orderBy: { position: "asc" },
      where: { deletedAt: null, projectId: input.projectId, workspaceId: input.workspaceId },
    });
  }

  async updateSection(input: { data: { name?: string; position?: number }; projectId: string; sectionId: string; workspaceId: string }) {
    const result = await this.prisma.section.updateMany({
      data: input.data,
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findSection(input);
  }

  async softDeleteSection(input: { projectId: string; sectionId: string; workspaceId: string }) {
    const result = await this.prisma.section.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.sectionId, projectId: input.projectId, workspaceId: input.workspaceId },
    });
    return result.count;
  }

  async reorderSections(input: { projectId: string; sections: Array<{ id: string; position: number }>; workspaceId: string }) {
    return this.prisma.$transaction(
      input.sections.map((section) =>
        this.prisma.section.updateMany({
          data: { position: section.position },
          where: { deletedAt: null, id: section.id, projectId: input.projectId, workspaceId: input.workspaceId },
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

  listLabels(input: { workspaceId: string }) {
    return this.prisma.taskLabel.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      where: { deletedAt: null, workspaceId: input.workspaceId },
    });
  }

  createLabel(input: { color: string; name: string; workspaceId: string }) {
    return this.prisma.taskLabel.create({ data: input });
  }

  findLabel(input: { labelId: string; workspaceId: string }) {
    return this.prisma.taskLabel.findFirst({
      where: { deletedAt: null, id: input.labelId, workspaceId: input.workspaceId },
    });
  }

  async updateLabel(input: { data: { color?: string; name?: string }; labelId: string; workspaceId: string }) {
    const result = await this.prisma.taskLabel.updateMany({
      data: input.data,
      where: { deletedAt: null, id: input.labelId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findLabel(input);
  }

  deleteLabel(input: { labelId: string; workspaceId: string }) {
    return this.prisma.taskLabel.deleteMany({
      where: { id: input.labelId, workspaceId: input.workspaceId },
    });
  }

  listTaskLabels(input: { taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.findMany({
      include: { label: true },
      orderBy: [{ label: { name: "asc" } }, { id: "asc" }],
      where: {
        label: { deletedAt: null },
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      },
    });
  }

  assignTaskLabel(input: { assignedById: string; labelId: string; taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.upsert({
      create: input,
      include: { label: true },
      update: { assignedById: input.assignedById },
      where: { taskId_labelId: { labelId: input.labelId, taskId: input.taskId } },
    });
  }

  unassignTaskLabel(input: { labelId: string; taskId: string; workspaceId: string }) {
    return this.prisma.taskLabelAssignment.deleteMany({
      where: { labelId: input.labelId, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  listTaskDependencies(input: { taskId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findMany({
      include: {
        blockedTask: {
          select: {
            _count: { select: { assignees: true } },
            dueDate: true,
            id: true,
            priority: true,
            status: true,
            title: true,
          },
        },
        blockingTask: {
          select: {
            _count: { select: { assignees: true } },
            dueDate: true,
            id: true,
            priority: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      where: {
        blockedTask: { deletedAt: null },
        blockingTask: { deletedAt: null },
        OR: [{ blockingTaskId: input.taskId }, { blockedTaskId: input.taskId }],
        workspaceId: input.workspaceId,
      },
    });
  }

  listProjectDependencyEdges(input: { projectId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findMany({
      select: { blockedTaskId: true, blockingTaskId: true },
      where: {
        blockedTask: { deletedAt: null },
        blockingTask: { deletedAt: null, projectId: input.projectId },
        workspaceId: input.workspaceId,
      },
    });
  }

  listProjectDependencyMapRows(input: { projectId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findMany({
      include: {
        blockedTask: {
          select: {
            dueDate: true,
            id: true,
            priority: true,
            sectionId: true,
            status: true,
            title: true,
          },
        },
        blockingTask: {
          select: {
            dueDate: true,
            id: true,
            priority: true,
            sectionId: true,
            status: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      where: {
        blockedTask: { deletedAt: null, projectId: input.projectId },
        blockingTask: { deletedAt: null, projectId: input.projectId },
        workspaceId: input.workspaceId,
      },
    });
  }

  listTaskDependencySummaryRows(input: { taskIds: string[]; workspaceId: string }) {
    const taskIds = [...new Set(input.taskIds)];
    if (!taskIds.length) return Promise.resolve([]);
    return this.prisma.taskDependency.findMany({
      select: {
        blockedTaskId: true,
        blockingTask: { select: { status: true } },
        blockingTaskId: true,
      },
      where: {
        blockedTask: { deletedAt: null },
        blockingTask: { deletedAt: null },
        OR: [{ blockedTaskId: { in: taskIds } }, { blockingTaskId: { in: taskIds } }],
        workspaceId: input.workspaceId,
      },
    });
  }

  listTasksUnblockedByCompletion(input: { blockingTaskId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findMany({
      select: {
        blockedTask: {
          select: {
            dependenciesAsBlocked: {
              select: { id: true },
              take: 1,
              where: {
                blockingTask: { deletedAt: null, status: { not: "DONE" } },
                blockingTaskId: { not: input.blockingTaskId },
                workspaceId: input.workspaceId,
              },
            },
            id: true,
            projectId: true,
            title: true,
          },
        },
        blockedTaskId: true,
        id: true,
      },
      where: {
        blockedTask: { deletedAt: null, status: { not: "DONE" } },
        blockingTaskId: input.blockingTaskId,
        workspaceId: input.workspaceId,
      },
    });
  }

  findTaskDependencyByPair(input: { blockedTaskId: string; blockingTaskId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findFirst({
      include: {
        blockedTask: { select: { id: true, status: true, title: true } },
        blockingTask: { select: { id: true, status: true, title: true } },
      },
      where: { blockedTaskId: input.blockedTaskId, blockingTaskId: input.blockingTaskId, workspaceId: input.workspaceId },
    });
  }

  findTaskDependency(input: { dependencyId: string; workspaceId: string }) {
    return this.prisma.taskDependency.findFirst({
      include: {
        blockedTask: { select: { id: true, projectId: true, status: true, title: true } },
        blockingTask: { select: { id: true, status: true, title: true } },
      },
      where: { id: input.dependencyId, workspaceId: input.workspaceId },
    });
  }

  createTaskDependency(input: { blockedTaskId: string; blockingTaskId: string; createdById: string; workspaceId: string }) {
    return this.prisma.taskDependency.create({
      data: {
        blockedTaskId: input.blockedTaskId,
        blockingTaskId: input.blockingTaskId,
        createdById: input.createdById,
        workspaceId: input.workspaceId,
      },
      include: {
        blockedTask: { select: { id: true, status: true, title: true } },
        blockingTask: { select: { id: true, status: true, title: true } },
      },
    });
  }

  deleteTaskDependency(input: { dependencyId: string; workspaceId: string }) {
    return this.prisma.taskDependency.deleteMany({
      where: { id: input.dependencyId, workspaceId: input.workspaceId },
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
        completedAt: completedAtForStatusTransition(input.data.status, new Date()),
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

  async updateComment(input: { body: string; commentId: string; workspaceId: string }) {
    const result = await this.prisma.comment.updateMany({
      data: { body: input.body, editedAt: new Date() },
      where: { deletedAt: null, id: input.commentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findComment(input.workspaceId, input.commentId);
  }

  softDeleteComment(input: { commentId: string; workspaceId: string }) {
    return this.prisma.comment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.commentId, workspaceId: input.workspaceId },
    });
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
    return this.prisma.attachment.create({
      data: {
        ...input,
        version: 1,
        versions: {
          create: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            objectKey: input.objectKey,
            sizeBytes: input.sizeBytes,
            uploadedById: input.uploadedById,
            version: 1,
            workspaceId: input.workspaceId,
          },
        },
      },
      include: attachmentWithActiveVersions,
    });
  }

  listAttachments(input: { cursor?: string; limit: number; taskId: string; workspaceId: string }) {
    return this.prisma.attachment.findMany({
      ...paginationArgs(input),
      include: attachmentWithActiveVersions,
      orderBy: { createdAt: "desc" },
      where: { activatedAt: { not: null }, deletedAt: null, taskId: input.taskId, workspaceId: input.workspaceId },
    });
  }

  createAttachmentComment(input: { attachmentId: string; authorId: string; body: string; versionId?: string | null; workspaceId: string }) {
    return this.prisma.attachmentComment.create({ data: input, include: attachmentCommentInclude });
  }

  listAttachmentComments(input: { attachmentId: string; cursor?: string; limit: number; workspaceId: string }) {
    return this.prisma.attachmentComment.findMany({
      ...paginationArgs(input),
      include: attachmentCommentInclude,
      orderBy: { createdAt: "asc" },
      where: { attachmentId: input.attachmentId, deletedAt: null, workspaceId: input.workspaceId },
    });
  }

  findAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.prisma.attachmentComment.findFirst({
      include: attachmentCommentInclude,
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
  }

  async updateAttachmentComment(input: { attachmentCommentId: string; body: string; workspaceId: string }) {
    const result = await this.prisma.attachmentComment.updateMany({
      data: { body: input.body, editedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findAttachmentComment(input);
  }

  softDeleteAttachmentComment(input: { attachmentCommentId: string; workspaceId: string }) {
    return this.prisma.attachmentComment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentCommentId, workspaceId: input.workspaceId },
    });
  }

  findAttachment(workspaceId: string, attachmentId: string) {
    return this.prisma.attachment.findFirst({
      include: attachmentWithActiveVersions,
      where: { activatedAt: { not: null }, deletedAt: null, id: attachmentId, workspaceId },
    });
  }

  findAttachmentIncludingPending(workspaceId: string, attachmentId: string) {
    return this.prisma.attachment.findFirst({ include: attachmentWithActiveVersions, where: { deletedAt: null, id: attachmentId, workspaceId } });
  }

  async recordAttachmentScanResult(input: { attachmentId: string; scan: AttachmentScanWrite; workspaceId: string }) {
    const scanData = attachmentScanData(input.scan);
    await this.prisma.$transaction([
      this.prisma.attachment.updateMany({
        data: scanData,
        where: { activatedAt: null, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
      }),
      this.prisma.attachmentVersion.updateMany({
        data: scanData,
        where: { activatedAt: null, attachmentId: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      }),
    ]);
  }

  async recordAttachmentVersionScanResult(input: { scan: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    await this.prisma.attachmentVersion.updateMany({
      data: attachmentScanData(input.scan),
      where: { activatedAt: null, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  completeAttachment(input: { attachmentId: string; scan?: AttachmentScanWrite; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.findFirst({
        include: { versions: { where: { version: 1 } } },
        where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
      });
      if (!attachment) return { activated: false, attachment: null, conflict: false };
      if (attachment.activatedAt) {
        return {
          activated: false,
          attachment: await tx.attachment.findFirst({
            include: attachmentWithActiveVersions,
            where: { activatedAt: { not: null }, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
          }),
          conflict: false,
        };
      }

      const initialVersion = attachment.versions[0];
      if (!initialVersion || attachment.version !== 1) return { activated: false, attachment: null, conflict: true };

      const activatedAt = new Date();
      const scanData = input.scan ? attachmentScanData(input.scan) : {};
      const updated = await tx.attachment.updateMany({
        data: { activatedAt, ...scanData },
        where: { activatedAt: null, deletedAt: null, id: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      });
      if (!updated.count) return { activated: false, attachment: null, conflict: true };

      await tx.attachmentVersion.updateMany({
        data: { activatedAt, ...scanData },
        where: { activatedAt: null, attachmentId: input.attachmentId, version: 1, workspaceId: input.workspaceId },
      });

      return {
        activated: true,
        attachment: await tx.attachment.findFirst({
          include: attachmentWithActiveVersions,
          where: { activatedAt: { not: null }, deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
        }),
        conflict: false,
      };
    });
  }

  async updateAttachment(input: { attachmentId: string; description: string | null; workspaceId: string }) {
    const result = await this.prisma.attachment.updateMany({
      data: { description: input.description },
      where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
    });
    if (!result.count) return null;
    return this.findAttachment(input.workspaceId, input.attachmentId);
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
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.attachmentVersion.findFirst({
        where: { activatedAt: null, attachmentId: input.attachmentId, version: input.version, workspaceId: input.workspaceId },
      });
      if (pending) {
        return tx.attachmentVersion.update({
          data: {
            fileName: input.fileName,
            mimeType: input.mimeType,
            objectKey: input.objectKey,
            scanCheckedAt: null,
            scanMessage: null,
            scanProvider: null,
            scanStatus: "PENDING",
            sizeBytes: input.sizeBytes,
            uploadedById: input.uploadedById,
          },
          where: { id: pending.id },
        });
      }
      return tx.attachmentVersion.create({ data: input });
    });
  }

  findAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.prisma.attachmentVersion.findFirst({
      include: { attachment: true },
      where: { attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  findActiveAttachmentVersion(input: { attachmentId: string; versionId: string; workspaceId: string }) {
    return this.prisma.attachmentVersion.findFirst({
      where: { activatedAt: { not: null }, attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
    });
  }

  completeAttachmentVersion(input: { attachmentId: string; scan?: AttachmentScanWrite; versionId: string; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.attachmentVersion.findFirst({
        include: { attachment: true },
        where: { attachmentId: input.attachmentId, id: input.versionId, workspaceId: input.workspaceId },
      });
      if (!version || version.attachment.deletedAt) return { activated: false, attachment: null, conflict: false, version: null };
      if (version.activatedAt) {
        return {
          activated: false,
          attachment: await tx.attachment.findFirst({
            include: attachmentWithActiveVersions,
            where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
          }),
          conflict: false,
          version,
        };
      }
      if (version.attachment.version !== version.version - 1) return { activated: false, attachment: null, conflict: true, version };

      const scanData = input.scan ? attachmentScanData(input.scan) : {};
      const updated = await tx.attachment.updateMany({
        data: {
          fileName: version.fileName,
          mimeType: version.mimeType,
          objectKey: version.objectKey,
          ...scanData,
          sizeBytes: version.sizeBytes,
          version: version.version,
        },
        where: { deletedAt: null, id: input.attachmentId, version: version.version - 1, workspaceId: input.workspaceId },
      });
      if (!updated.count) return { activated: false, attachment: null, conflict: true, version };

      const activatedVersion = await tx.attachmentVersion.update({ data: { activatedAt: new Date(), ...scanData }, where: { id: version.id } });
      return {
        activated: true,
        attachment: await tx.attachment.findFirst({
          include: attachmentWithActiveVersions,
          where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
        }),
        conflict: false,
        version: activatedVersion,
      };
    });
  }

  softDeleteAttachment(input: { attachmentId: string; workspaceId: string }) {
    return this.prisma.attachment.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, id: input.attachmentId, workspaceId: input.workspaceId },
    });
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

  findNotificationPreference(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceNotificationPreference.findUnique({
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }

  upsertNotificationPreference(input: { emailEnabled: boolean; userId: string; workspaceId: string }) {
    return this.prisma.workspaceNotificationPreference.upsert({
      create: input,
      update: { emailEnabled: input.emailEnabled },
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }

  searchWorkspace(input: { after?: SearchWorkspaceCursor; limit: number; q: string; type?: SearchResultType; userId: string; workspaceId: string }) {
    const accessibleProject = this.accessibleProjectWhere(input.userId, input.workspaceId);
    const tasks = input.type && input.type !== "task" ? [] : this.prisma.task.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        deletedAt: null,
        AND: compactWhere<Prisma.TaskWhereInput>([
          searchAfterWhere<Prisma.TaskWhereInput>("task", input.after),
          { OR: [{ title: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }] },
        ]),
        project: accessibleProject,
        workspaceId: input.workspaceId,
      },
    });
    const projects = input.type && input.type !== "project" ? [] : this.prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.limit + 1,
      where: {
        ...accessibleProject,
        AND: compactWhere<Prisma.ProjectWhereInput>([
          searchAfterWhere<Prisma.ProjectWhereInput>("project", input.after),
          { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }] },
        ]),
      },
    });
    return Promise.all([tasks, projects]);
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

  private accessibleProjectWhere(userId: string, workspaceId: string): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      workspaceId,
      OR: [
        { visibility: "WORKSPACE" },
        { members: { some: { deletedAt: null, userId } } },
        { workspace: { members: { some: { deletedAt: null, role: { in: ["OWNER", "ADMIN"] }, userId } } } },
      ],
    };
  }
}

export type SearchWorkspaceCursor = {
  id: string;
  type: SearchResultType;
  updatedAt: Date;
};

const searchResultTypeRank: Record<SearchResultType, number> = {
  project: 0,
  task: 1,
};

function compactWhere<TWhere>(items: Array<TWhere | undefined>) {
  return items.filter((item): item is TWhere => Boolean(item));
}

function attachmentScanData(scan: AttachmentScanWrite) {
  return {
    scanCheckedAt: scan.checkedAt,
    scanMessage: scan.message,
    scanProvider: scan.provider,
    scanStatus: scan.status,
  };
}

function searchAfterWhere<TWhere>(resultType: SearchResultType, after?: SearchWorkspaceCursor): TWhere | undefined {
  if (!after) return undefined;
  const resultRank = searchResultRank(resultType);
  const afterRank = searchResultRank(after.type);
  const sameTimestampFilters: Prisma.ProjectWhereInput[] = [];
  if (resultRank > afterRank) sameTimestampFilters.push({ updatedAt: after.updatedAt });
  if (resultRank === afterRank) sameTimestampFilters.push({ id: { gt: after.id }, updatedAt: after.updatedAt });
  return {
    OR: [{ updatedAt: { lt: after.updatedAt } }, ...sameTimestampFilters],
  } as TWhere;
}

function searchResultRank(type: SearchResultType) {
  return searchResultTypeRank[type] ?? 0;
}
