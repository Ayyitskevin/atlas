import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createSubtaskRequestSchema,
  cursorPaginationQuerySchema,
  updateSubtaskRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createSubtasksService } from "../work/create-work-service.js";
import { SubtasksController } from "./subtasks.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });

export async function registerSubtasksRoutes(app: FastifyInstance): Promise<void> {
  const controller = new SubtasksController(createSubtasksService());

    app.post("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ body: createSubtaskRequestSchema, params: taskParamsSchema, tags: ["Subtasks"] }) }, controller.createSubtask);
    app.get("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Subtasks"] }) }, controller.listSubtasks);
    app.patch("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ body: updateSubtaskRequestSchema, params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.updateSubtask);
    app.delete("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.deleteSubtask);
}
