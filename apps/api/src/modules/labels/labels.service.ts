import type { AuthContext } from "../../shared/auth-context.js";
import {
  AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import {
  ATLAS_ERROR_CODES,
  type CreateTaskLabelRequest,
  type UpdateTaskLabelRequest,
} from "@atlas/shared";
import {
  isPrismaUniqueConstraintError,
} from "../work/work-helpers.js";
import { WorkDomainBase } from "../work/work-domain-base.js";

export class LabelsService extends WorkDomainBase {
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

}
