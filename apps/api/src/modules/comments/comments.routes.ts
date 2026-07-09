import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createCommentRequestSchema,
  cursorPaginationQuerySchema,
  updateCommentRequestSchema
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createCommentsService } from "../work/create-work-service.js";
import { CommentsController } from "./comments.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });

export async function registerCommentsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new CommentsController(createCommentsService());

    app.post("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ body: createCommentRequestSchema, params: taskParamsSchema, tags: ["Comments"] }) }, controller.createComment);
    app.get("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Comments"] }) }, controller.listComments);
    app.patch("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ body: updateCommentRequestSchema, params: commentParamsSchema, tags: ["Comments"] }) }, controller.updateComment);
    app.delete("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ params: commentParamsSchema, tags: ["Comments"] }) }, controller.deleteComment);
}
