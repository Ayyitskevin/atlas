import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createSectionRequestSchema,
  cursorPaginationQuerySchema,
  reorderSectionsRequestSchema,
  updateSectionRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const sectionParamsSchema = projectParamsSchema.extend({ sectionId: z.string().uuid() });

export class SectionsController {
  constructor(private readonly workService: WorkService) {}

  createSection = async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    const result = await this.workService.createSection(await requireAuth(request), workspaceId, projectId, parseBody(request, createSectionRequestSchema));
    return reply.status(201).send(result);
  };
  listSections = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.workService.listSections(await requireAuth(request), workspaceId, projectId, parseQuery(request, cursorPaginationQuerySchema));
  };
  updateSection = async (request: FastifyRequest) => {
    const { projectId, sectionId, workspaceId } = parseParams(request, sectionParamsSchema);
    return this.workService.updateSection(await requireAuth(request), workspaceId, projectId, sectionId, parseBody(request, updateSectionRequestSchema));
  };
  deleteSection = async (request: FastifyRequest) => {
    const { projectId, sectionId, workspaceId } = parseParams(request, sectionParamsSchema);
    return this.workService.deleteSection(await requireAuth(request), workspaceId, projectId, sectionId);
  };
  reorderSections = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.workService.reorderSections(await requireAuth(request), workspaceId, projectId, parseBody(request, reorderSectionsRequestSchema));
  };
}
