import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createTaskLabelRequestSchema,
  cursorPaginationQuerySchema,
  updateTaskLabelRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { LabelsController } from "./labels.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const labelParamsSchema = workspaceParamsSchema.extend({ labelId: z.string().uuid() });
const taskLabelParamsSchema = taskParamsSchema.extend({ labelId: z.string().uuid() });

export async function registerLabelsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new LabelsController(createWorkService());

    app.get("/workspaces/:workspaceId/labels", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Labels"] }) }, controller.listLabels);
    app.post("/workspaces/:workspaceId/labels", { schema: openApiSchema({ body: createTaskLabelRequestSchema, params: workspaceParamsSchema, tags: ["Labels"] }) }, controller.createLabel);
    app.patch("/workspaces/:workspaceId/labels/:labelId", { schema: openApiSchema({ body: updateTaskLabelRequestSchema, params: labelParamsSchema, tags: ["Labels"] }) }, controller.updateLabel);
    app.delete("/workspaces/:workspaceId/labels/:labelId", { schema: openApiSchema({ params: labelParamsSchema, tags: ["Labels"] }) }, controller.deleteLabel);
    app.get("/workspaces/:workspaceId/tasks/:taskId/labels", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Labels"] }) }, controller.listTaskLabels);
    app.post("/workspaces/:workspaceId/tasks/:taskId/labels/:labelId", { schema: openApiSchema({ params: taskLabelParamsSchema, tags: ["Labels"] }) }, controller.assignTaskLabel);
    app.delete("/workspaces/:workspaceId/tasks/:taskId/labels/:labelId", { schema: openApiSchema({ params: taskLabelParamsSchema, tags: ["Labels"] }) }, controller.unassignTaskLabel);
}
