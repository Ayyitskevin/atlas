import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  addProjectMemberRequestSchema,
  createProjectRequestSchema,
  cursorPaginationQuerySchema,
  updateProjectMemberRequestSchema,
  updateProjectRequestSchema,
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { ProjectsService } from "./projects.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const projectMemberParamsSchema = projectParamsSchema.extend({ userId: z.string().uuid() });

export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    const result = await this.projectsService.create(await requireAuth(request), workspaceId, parseBody(request, createProjectRequestSchema));
    return reply.status(201).send(result);
  };

  list = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.projectsService.list(await requireAuth(request), workspaceId, parseQuery(request, cursorPaginationQuerySchema));
  };

  get = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.projectsService.get(await requireAuth(request), workspaceId, projectId);
  };

  update = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.projectsService.update(await requireAuth(request), workspaceId, projectId, parseBody(request, updateProjectRequestSchema));
  };

  archive = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.projectsService.archive(await requireAuth(request), workspaceId, projectId);
  };

  delete = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.projectsService.delete(await requireAuth(request), workspaceId, projectId);
  };

  listMembers = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.projectsService.listMembers(await requireAuth(request), workspaceId, projectId);
  };

  addMember = async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    const result = await this.projectsService.addMember(
      await requireAuth(request),
      workspaceId,
      projectId,
      parseBody(request, addProjectMemberRequestSchema),
    );
    return reply.status(201).send(result);
  };

  updateMember = async (request: FastifyRequest) => {
    const { projectId, userId, workspaceId } = parseParams(request, projectMemberParamsSchema);
    return this.projectsService.updateMember(
      await requireAuth(request),
      workspaceId,
      projectId,
      userId,
      parseBody(request, updateProjectMemberRequestSchema),
    );
  };

  removeMember = async (request: FastifyRequest) => {
    const { projectId, userId, workspaceId } = parseParams(request, projectMemberParamsSchema);
    return this.projectsService.removeMember(await requireAuth(request), workspaceId, projectId, userId);
  };
}
