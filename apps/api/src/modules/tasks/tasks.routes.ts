import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createTaskRequestSchema,
  cursorPaginationQuerySchema,
  moveTaskRequestSchema,
  myWorkQuerySchema,
  projectTaskQuerySchema,
  taskWatcherUserRequestSchema,
  updateTaskRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { TasksController } from "./tasks.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const taskWatcherParamsSchema = taskParamsSchema.extend({ userId: z.string().uuid() });
const userBodySchema = z.object({ userId: z.string().uuid() });

export async function registerTasksRoutes(app: FastifyInstance): Promise<void> {
  const controller = new TasksController(createWorkService());

    app.post("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ body: createTaskRequestSchema, params: projectParamsSchema, tags: ["Tasks"] }) }, controller.createTask);
    app.get("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ params: projectParamsSchema, querystring: projectTaskQuerySchema, tags: ["Tasks"] }) }, controller.listTasks);
    app.get("/workspaces/:workspaceId/my-work", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: myWorkQuerySchema, tags: ["Tasks"] }) }, controller.listMyWork);
    app.get("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.getTask);
    app.patch("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ body: updateTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.updateTask);
    app.delete("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.deleteTask);
    app.post("/workspaces/:workspaceId/tasks/:taskId/move", { schema: openApiSchema({ body: moveTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.moveTask);
    app.post("/workspaces/:workspaceId/tasks/:taskId/assign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.assignTask);
    app.post("/workspaces/:workspaceId/tasks/:taskId/unassign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.unassignTask);
    app.get("/workspaces/:workspaceId/tasks/:taskId/watchers", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Tasks"] }) }, controller.listTaskWatchers);
    app.post("/workspaces/:workspaceId/tasks/:taskId/watchers", { schema: openApiSchema({ body: taskWatcherUserRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.watchTask);
    app.delete("/workspaces/:workspaceId/tasks/:taskId/watchers/:userId", { schema: openApiSchema({ params: taskWatcherParamsSchema, tags: ["Tasks"] }) }, controller.unwatchTask);
    app.post("/workspaces/:workspaceId/tasks/:taskId/complete", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.completeTask);
    app.post("/workspaces/:workspaceId/tasks/:taskId/skip", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.skipRecurringTask);
}
