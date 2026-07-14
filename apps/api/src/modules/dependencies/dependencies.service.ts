import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import {
  ATLAS_ERROR_CODES,
  type AddTaskDependencyRequest,
} from "@atlas/shared";
import { wouldCreateDependencyCycle } from "../work/task-dependencies.js";
import {
  dateTimePayloadValue,
  dependencyEdgeView,
  dependencyMapStats,
  isPrismaUniqueConstraintError,
  longestOpenDependencyChain,
  uniqueDependencyMapNodes,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class DependenciesService extends WorkDomainBase {
  async listTaskDependencies(ctx: AuthContext, workspaceId: string, taskId: string) {
    await this.permissions.requireTaskRole(ctx, workspaceId, taskId, "VIEWER");
    const rows = await this.dependenciesRepo.listTaskDependencies({ taskId, workspaceId });
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
    const rows = await this.dependenciesRepo.listProjectDependencyMapRows({ projectId, workspaceId });
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
    const blockingTask = await this.tasksRepo.findTask(workspaceId, input.blockingTaskId);
    if (!blockingTask) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Blocking task not found in this Workspace.");
    if (blockingTask.projectId !== blockedTask.projectId) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Task dependencies must be within the same Project.");
    }
    const existing = await this.dependenciesRepo.findTaskDependencyByPair({
      blockedTaskId: taskId,
      blockingTaskId: input.blockingTaskId,
      workspaceId,
    });
    if (existing) return existing;
    const edges = await this.dependenciesRepo.listProjectDependencyEdges({ projectId: blockedTask.projectId, workspaceId });
    if (wouldCreateDependencyCycle(edges, input.blockingTaskId, taskId)) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "That dependency would create a circular dependency.");
    }
    try {
      const dependency = await this.dependenciesRepo.createTaskDependency({
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
        const created = await this.dependenciesRepo.findTaskDependencyByPair({
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
    const dependency = await this.dependenciesRepo.findTaskDependency({ dependencyId, workspaceId });
    if (!dependency) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task dependency not found.");
    await this.permissions.requireProjectRole(ctx, workspaceId, dependency.blockedTask.projectId, "EDITOR");
    const result = await this.dependenciesRepo.deleteTaskDependency({ dependencyId, workspaceId });
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

}
