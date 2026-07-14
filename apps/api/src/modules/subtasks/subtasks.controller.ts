import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createSubtaskRequestSchema,
  cursorPaginationQuerySchema,
  updateSubtaskRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { SubtasksService } from "./subtasks.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });

export class SubtasksController {
  constructor(private readonly service: SubtasksService) {}

  createSubtask = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.service.createSubtask(await requireAuth(request), workspaceId, taskId, parseBody(request, createSubtaskRequestSchema));
    return reply.status(201).send(result);
  };
  listSubtasks = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.service.listSubtasks(await requireAuth(request), workspaceId, taskId, parseQuery(request, cursorPaginationQuerySchema));
  };
  updateSubtask = async (request: FastifyRequest) => {
    const { subtaskId, workspaceId } = parseParams(request, subtaskParamsSchema);
    return this.service.updateSubtask(await requireAuth(request), workspaceId, subtaskId, parseBody(request, updateSubtaskRequestSchema));
  };
  deleteSubtask = async (request: FastifyRequest) => {
    const { subtaskId, workspaceId } = parseParams(request, subtaskParamsSchema);
    return this.service.deleteSubtask(await requireAuth(request), workspaceId, subtaskId);
  };
}
