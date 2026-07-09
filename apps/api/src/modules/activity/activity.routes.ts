import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { ActivityController } from "./activity.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ActivityController(createWorkService());

    app.get("/workspaces/:workspaceId/activity", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listWorkspaceActivity);
    app.get("/workspaces/:workspaceId/projects/:projectId/activity", { schema: openApiSchema({ params: projectParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listProjectActivity);
    app.get("/workspaces/:workspaceId/tasks/:taskId/activity", { schema: openApiSchema({ params: taskParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listTaskActivity);
}
