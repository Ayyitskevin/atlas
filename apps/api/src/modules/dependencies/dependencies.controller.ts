import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  addTaskDependencyRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams } from "../../shared/validation.js";
import { DependenciesService } from "./dependencies.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const taskDependencyParamsSchema = workspaceParamsSchema.extend({ dependencyId: z.string().uuid() });

export class DependenciesController {
  constructor(private readonly service: DependenciesService) {}

  listTaskDependencies = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.service.listTaskDependencies(await requireAuth(request), workspaceId, taskId);
  };
  listProjectDependencyMap = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.service.listProjectDependencyMap(await requireAuth(request), workspaceId, projectId);
  };
  addTaskDependency = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.service.addTaskDependency(await requireAuth(request), workspaceId, taskId, parseBody(request, addTaskDependencyRequestSchema));
    return reply.status(201).send(result);
  };
  removeTaskDependency = async (request: FastifyRequest) => {
    const { dependencyId, workspaceId } = parseParams(request, taskDependencyParamsSchema);
    return this.service.removeTaskDependency(await requireAuth(request), workspaceId, dependencyId);
  };
}
