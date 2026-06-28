import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createWorkspaceRequestSchema,
  cursorPaginationQuerySchema,
  inviteWorkspaceMemberRequestSchema,
  updateWorkspaceRequestSchema,
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkspacesService } from "./workspaces.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });

export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.workspacesService.create(await requireAuth(request), parseBody(request, createWorkspaceRequestSchema));
    return reply.status(201).send(result);
  };

  list = async (request: FastifyRequest) =>
    this.workspacesService.list(await requireAuth(request), parseQuery(request, cursorPaginationQuerySchema));

  get = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workspacesService.get(await requireAuth(request), workspaceId);
  };

  update = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workspacesService.update(await requireAuth(request), workspaceId, parseBody(request, updateWorkspaceRequestSchema));
  };

  delete = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workspacesService.delete(await requireAuth(request), workspaceId);
  };

  inviteMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    const result = await this.workspacesService.inviteMember(
      await requireAuth(request),
      workspaceId,
      parseBody(request, inviteWorkspaceMemberRequestSchema),
    );
    return reply.status(201).send(result);
  };

  listMembers = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workspacesService.listMembers(await requireAuth(request), workspaceId);
  };
}
