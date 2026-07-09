import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  attachmentDownloadResponseSchema,
  attachmentResponseSchema,
  createAttachmentCommentRequestSchema,
  createAttachmentRequestSchema,
  createAttachmentResponseSchema,
  cursorPaginationQuerySchema,
  replaceAttachmentRequestSchema,
  replaceAttachmentResponseSchema,
  updateAttachmentCommentRequestSchema,
  updateAttachmentRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { AttachmentsController } from "./attachments.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const attachmentParamsSchema = workspaceParamsSchema.extend({ attachmentId: z.string().uuid() });
const attachmentCommentParamsSchema = workspaceParamsSchema.extend({ attachmentCommentId: z.string().uuid() });
const attachmentVersionParamsSchema = attachmentParamsSchema.extend({ versionId: z.string().uuid() });

export async function registerAttachmentsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AttachmentsController(createWorkService());

    app.post("/workspaces/:workspaceId/tasks/:taskId/attachments", { schema: openApiSchema({ body: createAttachmentRequestSchema, params: taskParamsSchema, response: { 201: createAttachmentResponseSchema }, tags: ["Attachments"] }) }, controller.createAttachment);
    app.get("/workspaces/:workspaceId/tasks/:taskId/attachments", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Attachments"] }) }, controller.listAttachments);
    app.post("/workspaces/:workspaceId/attachments/:attachmentId/comments", { schema: openApiSchema({ body: createAttachmentCommentRequestSchema, params: attachmentParamsSchema, tags: ["Attachments"] }) }, controller.createAttachmentComment);
    app.get("/workspaces/:workspaceId/attachments/:attachmentId/comments", { schema: openApiSchema({ params: attachmentParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Attachments"] }) }, controller.listAttachmentComments);
    app.patch("/workspaces/:workspaceId/attachment-comments/:attachmentCommentId", { schema: openApiSchema({ body: updateAttachmentCommentRequestSchema, params: attachmentCommentParamsSchema, tags: ["Attachments"] }) }, controller.updateAttachmentComment);
    app.delete("/workspaces/:workspaceId/attachment-comments/:attachmentCommentId", { schema: openApiSchema({ params: attachmentCommentParamsSchema, tags: ["Attachments"] }) }, controller.deleteAttachmentComment);
    app.get("/workspaces/:workspaceId/attachments/:attachmentId/download", { schema: openApiSchema({ params: attachmentParamsSchema, response: { 200: attachmentDownloadResponseSchema }, tags: ["Attachments"] }) }, controller.getAttachmentDownload);
    app.post("/workspaces/:workspaceId/attachments/:attachmentId/complete", { schema: openApiSchema({ params: attachmentParamsSchema, response: { 200: attachmentResponseSchema }, tags: ["Attachments"] }) }, controller.completeAttachment);
    app.post("/workspaces/:workspaceId/attachments/:attachmentId/versions", { schema: openApiSchema({ body: replaceAttachmentRequestSchema, params: attachmentParamsSchema, response: { 201: replaceAttachmentResponseSchema }, tags: ["Attachments"] }) }, controller.createAttachmentVersion);
    app.post("/workspaces/:workspaceId/attachments/:attachmentId/versions/:versionId/complete", { schema: openApiSchema({ params: attachmentVersionParamsSchema, response: { 200: attachmentResponseSchema }, tags: ["Attachments"] }) }, controller.completeAttachmentVersion);
    app.patch("/workspaces/:workspaceId/attachments/:attachmentId", { schema: openApiSchema({ body: updateAttachmentRequestSchema, params: attachmentParamsSchema, response: { 200: attachmentResponseSchema }, tags: ["Attachments"] }) }, controller.updateAttachment);
    app.delete("/workspaces/:workspaceId/attachments/:attachmentId", { schema: openApiSchema({ params: attachmentParamsSchema, tags: ["Attachments"] }) }, controller.deleteAttachment);
}
