import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema,
  attachmentDownloadResponseSchema,
  createAttachmentRequestSchema,
  createAttachmentResponseSchema,
  createCommentRequestSchema,
  createSectionRequestSchema,
  createSubtaskRequestSchema,
  createTaskLabelRequestSchema,
  createTaskRequestSchema,
  cursorPaginationQuerySchema,
  moveTaskRequestSchema,
  myWorkQuerySchema,
  notificationQuerySchema,
  notificationPreferenceResponseSchema,
  reorderSectionsRequestSchema,
  searchResponseSchema,
  searchQuerySchema,
  updateCommentRequestSchema,
  updateNotificationPreferenceRequestSchema,
  updateSectionRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskLabelRequestSchema,
  updateTaskRequestSchema,
} from "@atlas/shared";
import { prisma } from "@atlas/db";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkController } from "./work.controller.js";
import { WorkRepository } from "./work.repository.js";
import { WorkService } from "./work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const sectionParamsSchema = projectParamsSchema.extend({ sectionId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const labelParamsSchema = workspaceParamsSchema.extend({ labelId: z.string().uuid() });
const taskLabelParamsSchema = taskParamsSchema.extend({ labelId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });
const attachmentParamsSchema = workspaceParamsSchema.extend({ attachmentId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });
const userBodySchema = z.object({ userId: z.string().uuid() });

export async function registerWorkRoutes(app: FastifyInstance): Promise<void> {
  const controller = new WorkController(
    new WorkService(new WorkRepository(prisma), new DomainEventsRepository(prisma), new PermissionsService(prisma)),
  );

  app.post("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ body: createSectionRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.createSection);
  app.get("/workspaces/:workspaceId/projects/:projectId/sections", { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Sections"] }) }, controller.listSections);
  app.patch("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ body: updateSectionRequestSchema, params: sectionParamsSchema, tags: ["Sections"] }) }, controller.updateSection);
  app.delete("/workspaces/:workspaceId/projects/:projectId/sections/:sectionId", { schema: openApiSchema({ params: sectionParamsSchema, tags: ["Sections"] }) }, controller.deleteSection);
  app.post("/workspaces/:workspaceId/projects/:projectId/sections/reorder", { schema: openApiSchema({ body: reorderSectionsRequestSchema, params: projectParamsSchema, tags: ["Sections"] }) }, controller.reorderSections);

  app.post("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ body: createTaskRequestSchema, params: projectParamsSchema, tags: ["Tasks"] }) }, controller.createTask);
  app.get("/workspaces/:workspaceId/projects/:projectId/tasks", { schema: openApiSchema({ params: projectParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Tasks"] }) }, controller.listTasks);
  app.get("/workspaces/:workspaceId/my-work", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: myWorkQuerySchema, tags: ["Tasks"] }) }, controller.listMyWork);
  app.get("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.getTask);
  app.patch("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ body: updateTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.updateTask);
  app.delete("/workspaces/:workspaceId/tasks/:taskId", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.deleteTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/move", { schema: openApiSchema({ body: moveTaskRequestSchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.moveTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/assign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.assignTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/unassign", { schema: openApiSchema({ body: userBodySchema, params: taskParamsSchema, tags: ["Tasks"] }) }, controller.unassignTask);
  app.post("/workspaces/:workspaceId/tasks/:taskId/complete", { schema: openApiSchema({ params: taskParamsSchema, tags: ["Tasks"] }) }, controller.completeTask);

  app.get("/workspaces/:workspaceId/labels", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Labels"] }) }, controller.listLabels);
  app.post("/workspaces/:workspaceId/labels", { schema: openApiSchema({ body: createTaskLabelRequestSchema, params: workspaceParamsSchema, tags: ["Labels"] }) }, controller.createLabel);
  app.patch("/workspaces/:workspaceId/labels/:labelId", { schema: openApiSchema({ body: updateTaskLabelRequestSchema, params: labelParamsSchema, tags: ["Labels"] }) }, controller.updateLabel);
  app.delete("/workspaces/:workspaceId/labels/:labelId", { schema: openApiSchema({ params: labelParamsSchema, tags: ["Labels"] }) }, controller.deleteLabel);
  app.get("/workspaces/:workspaceId/tasks/:taskId/labels", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Labels"] }) }, controller.listTaskLabels);
  app.post("/workspaces/:workspaceId/tasks/:taskId/labels/:labelId", { schema: openApiSchema({ params: taskLabelParamsSchema, tags: ["Labels"] }) }, controller.assignTaskLabel);
  app.delete("/workspaces/:workspaceId/tasks/:taskId/labels/:labelId", { schema: openApiSchema({ params: taskLabelParamsSchema, tags: ["Labels"] }) }, controller.unassignTaskLabel);

  app.post("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ body: createSubtaskRequestSchema, params: taskParamsSchema, tags: ["Subtasks"] }) }, controller.createSubtask);
  app.get("/workspaces/:workspaceId/tasks/:taskId/subtasks", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Subtasks"] }) }, controller.listSubtasks);
  app.patch("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ body: updateSubtaskRequestSchema, params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.updateSubtask);
  app.delete("/workspaces/:workspaceId/subtasks/:subtaskId", { schema: openApiSchema({ params: subtaskParamsSchema, tags: ["Subtasks"] }) }, controller.deleteSubtask);

  app.post("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ body: createCommentRequestSchema, params: taskParamsSchema, tags: ["Comments"] }) }, controller.createComment);
  app.get("/workspaces/:workspaceId/tasks/:taskId/comments", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Comments"] }) }, controller.listComments);
  app.patch("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ body: updateCommentRequestSchema, params: commentParamsSchema, tags: ["Comments"] }) }, controller.updateComment);
  app.delete("/workspaces/:workspaceId/comments/:commentId", { schema: openApiSchema({ params: commentParamsSchema, tags: ["Comments"] }) }, controller.deleteComment);

  app.post("/workspaces/:workspaceId/tasks/:taskId/attachments", { schema: openApiSchema({ body: createAttachmentRequestSchema, params: taskParamsSchema, response: { 201: createAttachmentResponseSchema }, tags: ["Attachments"] }) }, controller.createAttachment);
  app.get("/workspaces/:workspaceId/tasks/:taskId/attachments", { schema: openApiSchema({ params: taskParamsSchema, querystring: cursorPaginationQuerySchema, tags: ["Attachments"] }) }, controller.listAttachments);
  app.get("/workspaces/:workspaceId/attachments/:attachmentId/download", { schema: openApiSchema({ params: attachmentParamsSchema, response: { 200: attachmentDownloadResponseSchema }, tags: ["Attachments"] }) }, controller.getAttachmentDownload);
  app.delete("/workspaces/:workspaceId/attachments/:attachmentId", { schema: openApiSchema({ params: attachmentParamsSchema, tags: ["Attachments"] }) }, controller.deleteAttachment);

  app.get("/workspaces/:workspaceId/activity", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listWorkspaceActivity);
  app.get("/workspaces/:workspaceId/projects/:projectId/activity", { schema: openApiSchema({ params: projectParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listProjectActivity);
  app.get("/workspaces/:workspaceId/tasks/:taskId/activity", { schema: openApiSchema({ params: taskParamsSchema, querystring: activityQuerySchema, tags: ["Activity"] }) }, controller.listTaskActivity);

  app.get("/workspaces/:workspaceId/notifications", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: notificationQuerySchema, tags: ["Notifications"] }) }, controller.listNotifications);
  app.get(
    "/workspaces/:workspaceId/notification-preferences",
    {
      schema: openApiSchema({
        params: workspaceParamsSchema,
        response: { 200: notificationPreferenceResponseSchema },
        tags: ["Notifications"],
      }),
    },
    controller.getNotificationPreferences,
  );
  app.patch(
    "/workspaces/:workspaceId/notification-preferences",
    {
      schema: openApiSchema({
        body: updateNotificationPreferenceRequestSchema,
        params: workspaceParamsSchema,
        response: { 200: notificationPreferenceResponseSchema },
        tags: ["Notifications"],
      }),
    },
    controller.updateNotificationPreferences,
  );
  app.post("/workspaces/:workspaceId/notifications/:notificationId/read", { schema: openApiSchema({ params: notificationParamsSchema, tags: ["Notifications"] }) }, controller.markNotificationRead);
  app.post("/workspaces/:workspaceId/notifications/read-all", { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Notifications"] }) }, controller.markAllNotificationsRead);

  app.get(
    "/workspaces/:workspaceId/search",
    {
      schema: openApiSchema({
        params: workspaceParamsSchema,
        querystring: searchQuerySchema,
        response: { 200: searchResponseSchema },
        tags: ["Search"],
      }),
    },
    controller.search,
  );
}
