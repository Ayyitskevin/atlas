import { WorkRepositoryBase } from "../work/work-repository-base.js";

export class DependenciesRepository extends WorkRepositoryBase {
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
}
