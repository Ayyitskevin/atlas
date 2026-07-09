import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });

export class ActivityController {
  constructor(private readonly workService: WorkService) {}

  listWorkspaceActivity = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, parseQuery(request, activityQuerySchema));
  };
  listProjectActivity = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    const query = parseQuery(request, activityQuerySchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, { ...query, projectId });
  };
  listTaskActivity = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const query = parseQuery(request, activityQuerySchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, { ...query, taskId });
  };
}
