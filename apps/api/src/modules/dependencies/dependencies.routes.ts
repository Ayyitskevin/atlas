import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { addTaskDependencyRequestSchema, projectDependencyMapResponseSchema } from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createDependenciesService } from "../work/create-work-service.js";
import { DependenciesController } from "./dependencies.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const taskDependencyParamsSchema = workspaceParamsSchema.extend({ dependencyId: z.string().uuid() });

export async function registerDependenciesRoutes(app: FastifyInstance): Promise<void> {
  const controller = new DependenciesController(createDependenciesService());

  app.get(
    "/workspaces/:workspaceId/projects/:projectId/dependencies",
    {
      schema: openApiSchema({
        params: projectParamsSchema,
        response: { 200: projectDependencyMapResponseSchema },
        tags: ["Dependencies"],
      }),
    },
    controller.listProjectDependencyMap,
  );
  app.get(
    "/workspaces/:workspaceId/tasks/:taskId/dependencies",
    { schema: openApiSchema({ params: taskParamsSchema, tags: ["Dependencies"] }) },
    controller.listTaskDependencies,
  );
  app.post(
    "/workspaces/:workspaceId/tasks/:taskId/dependencies",
    {
      schema: openApiSchema({
        body: addTaskDependencyRequestSchema,
        params: taskParamsSchema,
        tags: ["Dependencies"],
      }),
    },
    controller.addTaskDependency,
  );
  app.delete(
    "/workspaces/:workspaceId/task-dependencies/:dependencyId",
    { schema: openApiSchema({ params: taskDependencyParamsSchema, tags: ["Dependencies"] }) },
    controller.removeTaskDependency,
  );
}
