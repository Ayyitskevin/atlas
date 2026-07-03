import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  addProjectMemberRequestSchema,
  createProjectMessageRequestSchema,
  createProjectRequestSchema,
  cursorPaginationQuerySchema,
  updateProjectMessageRequestSchema,
  updateProjectMemberRequestSchema,
  updateProjectRequestSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const projectMemberParamsSchema = projectParamsSchema.extend({ userId: z.string().uuid() });
const projectMessageParamsSchema = projectParamsSchema.extend({ messageId: z.string().uuid() });

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  const controller = new ProjectsController(
    new ProjectsService(new ProjectsRepository(prisma), new DomainEventsRepository(prisma), new PermissionsService(prisma)),
  );

  app.post(
    "/workspaces/:workspaceId/projects",
    { schema: openApiSchema({ body: createProjectRequestSchema, params: workspaceParamsSchema, tags: ["Projects"] }) },
    controller.create,
  );
  app.get(
    "/workspaces/:workspaceId/projects",
    { schema: openApiSchema({ params: workspaceParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Projects"] }) },
    controller.list,
  );
  app.get(
    "/workspaces/:workspaceId/projects/:projectId",
    { schema: openApiSchema({ params: projectParamsSchema, tags: ["Projects"] }) },
    controller.get,
  );
  app.patch(
    "/workspaces/:workspaceId/projects/:projectId",
    { schema: openApiSchema({ body: updateProjectRequestSchema, params: projectParamsSchema, tags: ["Projects"] }) },
    controller.update,
  );
  app.post(
    "/workspaces/:workspaceId/projects/:projectId/archive",
    { schema: openApiSchema({ params: projectParamsSchema, tags: ["Projects"] }) },
    controller.archive,
  );
  app.delete(
    "/workspaces/:workspaceId/projects/:projectId",
    { schema: openApiSchema({ params: projectParamsSchema, tags: ["Projects"] }) },
    controller.delete,
  );
  app.get(
    "/workspaces/:workspaceId/projects/:projectId/members",
    { schema: openApiSchema({ params: projectParamsSchema, tags: ["Projects"] }) },
    controller.listMembers,
  );
  app.post(
    "/workspaces/:workspaceId/projects/:projectId/members",
    { schema: openApiSchema({ body: addProjectMemberRequestSchema, params: projectParamsSchema, tags: ["Projects"] }) },
    controller.addMember,
  );
  app.patch(
    "/workspaces/:workspaceId/projects/:projectId/members/:userId",
    { schema: openApiSchema({ body: updateProjectMemberRequestSchema, params: projectMemberParamsSchema, tags: ["Projects"] }) },
    controller.updateMember,
  );
  app.delete(
    "/workspaces/:workspaceId/projects/:projectId/members/:userId",
    { schema: openApiSchema({ params: projectMemberParamsSchema, tags: ["Projects"] }) },
    controller.removeMember,
  );
  app.get(
    "/workspaces/:workspaceId/projects/:projectId/messages",
    { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Project Messages"] }) },
    controller.listMessages,
  );
  app.post(
    "/workspaces/:workspaceId/projects/:projectId/messages",
    { schema: openApiSchema({ body: createProjectMessageRequestSchema, params: projectParamsSchema, tags: ["Project Messages"] }) },
    controller.createMessage,
  );
  app.patch(
    "/workspaces/:workspaceId/projects/:projectId/messages/:messageId",
    { schema: openApiSchema({ body: updateProjectMessageRequestSchema, params: projectMessageParamsSchema, tags: ["Project Messages"] }) },
    controller.updateMessage,
  );
  app.delete(
    "/workspaces/:workspaceId/projects/:projectId/messages/:messageId",
    { schema: openApiSchema({ params: projectMessageParamsSchema, tags: ["Project Messages"] }) },
    controller.deleteMessage,
  );
}
