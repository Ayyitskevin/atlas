import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createWorkspaceRequestSchema,
  cursorPaginationQuerySchema,
  inviteWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkspacesController } from "./workspaces.controller.js";
import { WorkspacesRepository } from "./workspaces.repository.js";
import { WorkspacesService } from "./workspaces.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  const controller = new WorkspacesController(
    new WorkspacesService(new WorkspacesRepository(prisma), new PermissionsService(prisma)),
  );

  app.post("/workspaces", { schema: openApiSchema({ body: createWorkspaceRequestSchema, tags: ["Workspaces"] }) }, controller.create);
  app.get("/workspaces", { schema: openApiSchema({ querystring: cursorPaginationQuerySchema, tags: ["Workspaces"] }) }, controller.list);
  app.get("/workspaces/:workspaceId", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Workspaces"] }) }, controller.get);
  app.patch(
    "/workspaces/:workspaceId",
    { schema: openApiSchema({ body: updateWorkspaceRequestSchema, params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.update,
  );
  app.delete("/workspaces/:workspaceId", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Workspaces"] }) }, controller.delete);
  app.post(
    "/workspaces/:workspaceId/invitations",
    { schema: openApiSchema({ body: inviteWorkspaceMemberRequestSchema, params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.inviteMember,
  );
  app.get(
    "/workspaces/:workspaceId/members",
    { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.listMembers,
  );
}
