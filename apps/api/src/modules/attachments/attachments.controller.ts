import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createAttachmentCommentRequestSchema,
  createAttachmentRequestSchema,
  cursorPaginationQuerySchema,
  replaceAttachmentRequestSchema,
  updateAttachmentCommentRequestSchema,
  updateAttachmentRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { AttachmentsService } from "./attachments.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const attachmentParamsSchema = workspaceParamsSchema.extend({ attachmentId: z.string().uuid() });
const attachmentCommentParamsSchema = workspaceParamsSchema.extend({ attachmentCommentId: z.string().uuid() });
const attachmentVersionParamsSchema = attachmentParamsSchema.extend({ versionId: z.string().uuid() });

export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  createAttachment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.service.createAttachment(await requireAuth(request), workspaceId, taskId, parseBody(request, createAttachmentRequestSchema));
    return reply.status(201).send(result);
  };
  listAttachments = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.service.listAttachments(await requireAuth(request), workspaceId, taskId, parseQuery(request, cursorPaginationQuerySchema));
  };
  createAttachmentComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    const result = await this.service.createAttachmentComment(
      await requireAuth(request),
      workspaceId,
      attachmentId,
      parseBody(request, createAttachmentCommentRequestSchema),
    );
    return reply.status(201).send(result);
  };
  listAttachmentComments = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.service.listAttachmentComments(
      await requireAuth(request),
      workspaceId,
      attachmentId,
      parseQuery(request, cursorPaginationQuerySchema),
    );
  };
  updateAttachmentComment = async (request: FastifyRequest) => {
    const { attachmentCommentId, workspaceId } = parseParams(request, attachmentCommentParamsSchema);
    return this.service.updateAttachmentComment(
      await requireAuth(request),
      workspaceId,
      attachmentCommentId,
      parseBody(request, updateAttachmentCommentRequestSchema),
    );
  };
  deleteAttachmentComment = async (request: FastifyRequest) => {
    const { attachmentCommentId, workspaceId } = parseParams(request, attachmentCommentParamsSchema);
    return this.service.deleteAttachmentComment(await requireAuth(request), workspaceId, attachmentCommentId);
  };
  getAttachmentDownload = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.service.getAttachmentDownload(await requireAuth(request), workspaceId, attachmentId);
  };
  completeAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.service.completeAttachment(await requireAuth(request), workspaceId, attachmentId);
  };
  createAttachmentVersion = async (request: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    const result = await this.service.createAttachmentVersion(await requireAuth(request), workspaceId, attachmentId, parseBody(request, replaceAttachmentRequestSchema));
    return reply.status(201).send(result);
  };
  completeAttachmentVersion = async (request: FastifyRequest) => {
    const { attachmentId, versionId, workspaceId } = parseParams(request, attachmentVersionParamsSchema);
    return this.service.completeAttachmentVersion(await requireAuth(request), workspaceId, attachmentId, versionId);
  };
  updateAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.service.updateAttachment(await requireAuth(request), workspaceId, attachmentId, parseBody(request, updateAttachmentRequestSchema));
  };
  deleteAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.service.deleteAttachment(await requireAuth(request), workspaceId, attachmentId);
  };
}
