import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  acceptWorkspaceInvitationRequestSchema,
  createWorkspaceRequestSchema,
  cursorPaginationQuerySchema,
  inviteWorkspaceMemberRequestSchema,
  transferWorkspaceOwnerRequestSchema,
  updateWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { env } from "../../config/env.js";
import { createEmailProvider } from "../../email/email-provider.js";
import { openApiSchema } from "../../shared/zod-openapi.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkspacesController } from "./workspaces.controller.js";
import { WorkspacesRepository } from "./workspaces.repository.js";
import { WorkspacesService } from "./workspaces.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const invitationParamsSchema = workspaceParamsSchema.extend({ invitationId: z.string().uuid() });
const memberParamsSchema = workspaceParamsSchema.extend({ userId: z.string().uuid() });

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  const controller = new WorkspacesController(
    new WorkspacesService(
      new WorkspacesRepository(prisma),
      new PermissionsService(prisma),
      createEmailProvider({ from: env.EMAIL_FROM, provider: env.EMAIL_PROVIDER }),
      env.WEB_ORIGIN,
    ),
  );

  app.post("/workspaces", { schema: openApiSchema({ body: createWorkspaceRequestSchema, tags: ["Workspaces"] }) }, controller.create);
  app.get("/workspaces", { schema: openApiSchema({ querystring: cursorPaginationQuerySchema, tags: ["Workspaces"] }) }, controller.list);
  app.post(
    "/workspaces/invitations/accept",
    { schema: openApiSchema({ body: acceptWorkspaceInvitationRequestSchema, tags: ["Workspaces"] }) },
    controller.acceptInvitation,
  );
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
    "/workspaces/:workspaceId/invitations",
    { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.listInvitations,
  );
  app.post(
    "/workspaces/:workspaceId/invitations/:invitationId/cancel",
    { schema: openApiSchema({ params: invitationParamsSchema, tags: ["Workspaces"] }) },
    controller.cancelInvitation,
  );
  app.post(
    "/workspaces/:workspaceId/invitations/:invitationId/resend",
    { schema: openApiSchema({ params: invitationParamsSchema, tags: ["Workspaces"] }) },
    controller.resendInvitation,
  );
  app.get(
    "/workspaces/:workspaceId/members",
    { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.listMembers,
  );
  app.patch(
    "/workspaces/:workspaceId/members/:userId",
    { schema: openApiSchema({ body: updateWorkspaceMemberRequestSchema, params: memberParamsSchema, tags: ["Workspaces"] }) },
    controller.updateMember,
  );
  app.delete(
    "/workspaces/:workspaceId/members/:userId",
    { schema: openApiSchema({ params: memberParamsSchema, tags: ["Workspaces"] }) },
    controller.removeMember,
  );
  app.post(
    "/workspaces/:workspaceId/owner-transfer",
    { schema: openApiSchema({ body: transferWorkspaceOwnerRequestSchema, params: workspaceParamsSchema, tags: ["Workspaces"] }) },
    controller.transferOwner,
  );
}
