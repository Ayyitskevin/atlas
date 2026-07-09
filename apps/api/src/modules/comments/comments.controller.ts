import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createCommentRequestSchema,
  cursorPaginationQuerySchema,
  updateCommentRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });

export class CommentsController {
  constructor(private readonly workService: WorkService) {}

  createComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.workService.createComment(await requireAuth(request), workspaceId, taskId, parseBody(request, createCommentRequestSchema));
    return reply.status(201).send(result);
  };
  listComments = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listComments(await requireAuth(request), workspaceId, taskId, parseQuery(request, cursorPaginationQuerySchema));
  };
  updateComment = async (request: FastifyRequest) => {
    const { commentId, workspaceId } = parseParams(request, commentParamsSchema);
    return this.workService.updateComment(await requireAuth(request), workspaceId, commentId, parseBody(request, updateCommentRequestSchema));
  };
  deleteComment = async (request: FastifyRequest) => {
    const { commentId, workspaceId } = parseParams(request, commentParamsSchema);
    return this.workService.deleteComment(await requireAuth(request), workspaceId, commentId);
  };
}
