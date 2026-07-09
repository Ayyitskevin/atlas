import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createTaskLabelRequestSchema,
  updateTaskLabelRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams } from "../../shared/validation.js";
import { LabelsService } from "./labels.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const labelParamsSchema = workspaceParamsSchema.extend({ labelId: z.string().uuid() });
const taskLabelParamsSchema = taskParamsSchema.extend({ labelId: z.string().uuid() });

export class LabelsController {
  constructor(private readonly service: LabelsService) {}

  listLabels = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.service.listLabels(await requireAuth(request), workspaceId);
  };
  createLabel = async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    const result = await this.service.createLabel(await requireAuth(request), workspaceId, parseBody(request, createTaskLabelRequestSchema));
    return reply.status(201).send(result);
  };
  updateLabel = async (request: FastifyRequest) => {
    const { labelId, workspaceId } = parseParams(request, labelParamsSchema);
    return this.service.updateLabel(await requireAuth(request), workspaceId, labelId, parseBody(request, updateTaskLabelRequestSchema));
  };
  deleteLabel = async (request: FastifyRequest) => {
    const { labelId, workspaceId } = parseParams(request, labelParamsSchema);
    return this.service.deleteLabel(await requireAuth(request), workspaceId, labelId);
  };
  listTaskLabels = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.service.listTaskLabels(await requireAuth(request), workspaceId, taskId);
  };
  assignTaskLabel = async (request: FastifyRequest) => {
    const { labelId, taskId, workspaceId } = parseParams(request, taskLabelParamsSchema);
    return this.service.assignTaskLabel(await requireAuth(request), workspaceId, taskId, labelId);
  };
  unassignTaskLabel = async (request: FastifyRequest) => {
    const { labelId, taskId, workspaceId } = parseParams(request, taskLabelParamsSchema);
    return this.service.unassignTaskLabel(await requireAuth(request), workspaceId, taskId, labelId);
  };
}
