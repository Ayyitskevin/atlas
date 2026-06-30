import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema,
  createAttachmentRequestSchema,
  createCommentRequestSchema,
  createSectionRequestSchema,
  createSubtaskRequestSchema,
  createTaskRequestSchema,
  cursorPaginationQuerySchema,
  moveTaskRequestSchema,
  myWorkQuerySchema,
  notificationQuerySchema,
  reorderSectionsRequestSchema,
  searchQuerySchema,
  updateCommentRequestSchema,
  updateSectionRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskRequestSchema,
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "./work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const sectionParamsSchema = projectParamsSchema.extend({ sectionId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });
const attachmentParamsSchema = workspaceParamsSchema.extend({ attachmentId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });
const userBodySchema = z.object({ userId: z.string().uuid() });

export class WorkController {
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

  createTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    const result = await this.workService.createTask(await requireAuth(request), workspaceId, projectId, parseBody(request, createTaskRequestSchema));
    return reply.status(201).send(result);
  };

  listTasks = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.workService.listTasks(await requireAuth(request), workspaceId, projectId, parseQuery(request, cursorPaginationQuerySchema));
  };

  listMyWork = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.listMyWork(await requireAuth(request), workspaceId, parseQuery(request, myWorkQuerySchema));
  };

  getTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.getTask(await requireAuth(request), workspaceId, taskId);
  };

  updateTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.updateTask(await requireAuth(request), workspaceId, taskId, parseBody(request, updateTaskRequestSchema));
  };

  deleteTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.deleteTask(await requireAuth(request), workspaceId, taskId);
  };

  moveTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.moveTask(await requireAuth(request), workspaceId, taskId, parseBody(request, moveTaskRequestSchema));
  };

  assignTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const { userId } = parseBody(request, userBodySchema);
    return this.workService.assignTask(await requireAuth(request), workspaceId, taskId, userId);
  };

  unassignTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const { userId } = parseBody(request, userBodySchema);
    return this.workService.unassignTask(await requireAuth(request), workspaceId, taskId, userId);
  };

  completeTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.completeTask(await requireAuth(request), workspaceId, taskId);
  };

  createSubtask = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.workService.createSubtask(await requireAuth(request), workspaceId, taskId, parseBody(request, createSubtaskRequestSchema));
    return reply.status(201).send(result);
  };

  listSubtasks = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listSubtasks(await requireAuth(request), workspaceId, taskId, parseQuery(request, cursorPaginationQuerySchema));
  };

  updateSubtask = async (request: FastifyRequest) => {
    const { subtaskId, workspaceId } = parseParams(request, subtaskParamsSchema);
    return this.workService.updateSubtask(await requireAuth(request), workspaceId, subtaskId, parseBody(request, updateSubtaskRequestSchema));
  };

  deleteSubtask = async (request: FastifyRequest) => {
    const { subtaskId, workspaceId } = parseParams(request, subtaskParamsSchema);
    return this.workService.deleteSubtask(await requireAuth(request), workspaceId, subtaskId);
  };

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

  createAttachment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.workService.createAttachment(await requireAuth(request), workspaceId, taskId, parseBody(request, createAttachmentRequestSchema));
    return reply.status(201).send(result);
  };

  listAttachments = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listAttachments(await requireAuth(request), workspaceId, taskId, parseQuery(request, cursorPaginationQuerySchema));
  };

  getAttachmentDownload = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.getAttachmentDownload(await requireAuth(request), workspaceId, attachmentId);
  };

  deleteAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.deleteAttachment(await requireAuth(request), workspaceId, attachmentId);
  };

  listWorkspaceActivity = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, parseQuery(request, activityQuerySchema));
  };

  listProjectActivity = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    const query = parseQuery(request, activityQuerySchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, { ...query, projectId });
  };

  listTaskActivity = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const query = parseQuery(request, activityQuerySchema);
    return this.workService.listActivity(await requireAuth(request), workspaceId, { ...query, taskId });
  };

  listNotifications = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.listNotifications(await requireAuth(request), workspaceId, parseQuery(request, notificationQuerySchema));
  };

  markNotificationRead = async (request: FastifyRequest) => {
    const { notificationId, workspaceId } = parseParams(request, notificationParamsSchema);
    return this.workService.markNotificationRead(await requireAuth(request), workspaceId, notificationId);
  };

  markAllNotificationsRead = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.markAllNotificationsRead(await requireAuth(request), workspaceId);
  };

  search = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.search(await requireAuth(request), workspaceId, parseQuery(request, searchQuerySchema));
  };
}
