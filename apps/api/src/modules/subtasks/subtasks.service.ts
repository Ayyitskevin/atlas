import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateSubtaskRequest,
  type CursorPaginationQuery,
  type UpdateSubtaskRequest,
} from "@atlas/shared";
import { defaultListPosition } from "../work/position.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class SubtasksService extends WorkDomainBase {
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

}
