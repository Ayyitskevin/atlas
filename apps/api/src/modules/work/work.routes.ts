import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema,
  createCommentRequestSchema,
  createSectionRequestSchema,
  createSubtaskRequestSchema,
  createTaskRequestSchema,
  cursorPaginationQuerySchema,
  moveTaskRequestSchema,
  notificationQuerySchema,
  reorderSectionsRequestSchema,
  searchQuerySchema,
  updateCommentRequestSchema,
  updateSectionRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskRequestSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkController } from "./work.controller.js";
import { WorkRepository } from "./work.repository.js";
import { WorkService } from "./work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const sectionParamsSchema = projectParamsSchema.extend({ sectionId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });
const userBodySchema = z.object({ userId: z.string().uuid() });

export async function registerWorkRoutes(app: FastifyInstance): Promise<void> {
  const controller = new WorkController(new WorkService(new WorkRepository(prisma), new PermissionsService(prisma)));

  app.post("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ body: createSectionRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.createSection);
  app.get("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Sections"] }) }, controller.listSections);
  app.patch("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ body: updateSectionRequestSchema, params: sectionParamsSchema, tags: ["Sections"] }) }, controller.updateSection);
  app.delete("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ params: sectionParamsSchema, tags: ["Sections"] }) }, controller.deleteSection);
  app.post("/workspaces/:workspaceId/projects/:projectId/sections/reorder", { schema: openApiSchema({ body: reorderSectionsRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.reorderSections);

  app.post("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ body: createTaskRequestSchema, params: projectParamsSchema, tags: ["Tasks"] }) }, controller.createTask);
  app.get("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Tasks"] }) }, controller.listTasks);
  app.get("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.getTask);
  app.patch("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ body: updateTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.updateTask);
  app.delete("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.deleteTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/move", { schema: openApiSchema({ body: moveTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.moveTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/assign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.assignTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/unassign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.unassignTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/complete", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.completeTask);

  app.post("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ body: createSubtaskRequestSchema, params: taskParamsSchema, tags: ["Subtasks"] }) }, controller.createSubtask);
  app.get("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Subtasks"] }) }, controller.listSubtasks);
  app.patch("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ body: updateSubtaskRequestSchema, params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.updateSubtask);
  app.delete("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.deleteSubtask);

  app.post("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ body: createCommentRequestSchema, params: taskParamsSchema, tags: ["Comments"] }) }, controller.createComment);
  app.get("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Comments"] }) }, controller.listComments);
  app.patch("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ body: updateCommentRequestSchema, params: commentParamsSchema, tags: ["Comments"] }) }, controller.updateComment);
  app.delete("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ params: commentParamsSchema, tags: ["Comments"] }) }, controller.deleteComment);

  app.get("/workspaces/:workspaceId/activity", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listActivity);
  app.get("/workspaces/:workspaceId/projects/:projectId/activity", { schema: openApiSchema({ params: projectParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listActivity);
  app.get("/workspaces/:workspaceId/tasks/:taskId/activity", { schema: openApiSchema({ params: taskParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listActivity);

  app.get("/workspaces/:workspaceId/notifications", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: notificationQuerySchema, tags: ["Notifications"] }) }, controller.listNotifications);
  app.post("/workspaces/:workspaceId/notifications/:notificationId/read", { schema: openApiSchema({ params: notificationParamsSchema, tags: ["Notifications"] }) }, controller.markNotificationRead);
  app.post("/workspaces/:workspaceId/notifications/read-all", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Notifications"] }) }, controller.markAllNotificationsRead);

  app.get("/workspaces/:workspaceId/search", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: searchQuerySchema, tags: ["Search"] }) }, controller.search);
}
