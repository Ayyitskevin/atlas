import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  activityQuerySchema,
  addTaskDependencyRequestSchema,
  createAttachmentCommentRequestSchema,
  createAttachmentRequestSchema,
  createCommentRequestSchema,
  createSectionRequestSchema,
  createSubtaskRequestSchema,
  createTaskLabelRequestSchema,
  createTaskRequestSchema,
  cursorPaginationQuerySchema,
  moveTaskRequestSchema,
  myWorkQuerySchema,
  notificationQuerySchema,
  projectTaskQuerySchema,
  replaceAttachmentRequestSchema,
  reorderSectionsRequestSchema,
  searchQuerySchema,
  taskWatcherUserRequestSchema,
  updateAttachmentCommentRequestSchema,
  updateAttachmentRequestSchema,
  updateCommentRequestSchema,
  updateTaskLabelRequestSchema,
  updateNotificationPreferenceRequestSchema,
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
const taskWatcherParamsSchema = taskParamsSchema.extend({ userId: z.string().uuid() });
const labelParamsSchema = workspaceParamsSchema.extend({ labelId: z.string().uuid() });
const taskLabelParamsSchema = taskParamsSchema.extend({ labelId: z.string().uuid() });
const taskDependencyParamsSchema = workspaceParamsSchema.extend({ dependencyId: z.string().uuid() });
const subtaskParamsSchema = workspaceParamsSchema.extend({ subtaskId: z.string().uuid() });
const commentParamsSchema = workspaceParamsSchema.extend({ commentId: z.string().uuid() });
const attachmentParamsSchema = workspaceParamsSchema.extend({ attachmentId: z.string().uuid() });
const attachmentCommentParamsSchema = workspaceParamsSchema.extend({ attachmentCommentId: z.string().uuid() });
const attachmentVersionParamsSchema = attachmentParamsSchema.extend({ versionId: z.string().uuid() });
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
    return this.workService.listTasks(await requireAuth(request), workspaceId, projectId, parseQuery(request, projectTaskQuerySchema));
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

  listTaskWatchers = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listTaskWatchers(await requireAuth(request), workspaceId, taskId);
  };

  watchTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const { userId } = parseBody(request, taskWatcherUserRequestSchema);
    return this.workService.watchTask(await requireAuth(request), workspaceId, taskId, userId);
  };

  unwatchTask = async (request: FastifyRequest) => {
    const { taskId, userId, workspaceId } = parseParams(request, taskWatcherParamsSchema);
    return this.workService.unwatchTask(await requireAuth(request), workspaceId, taskId, userId);
  };

  completeTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.completeTask(await requireAuth(request), workspaceId, taskId);
  };

  skipRecurringTask = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.skipRecurringTask(await requireAuth(request), workspaceId, taskId);
  };

  listLabels = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.listLabels(await requireAuth(request), workspaceId);
  };

  createLabel = async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    const result = await this.workService.createLabel(await requireAuth(request), workspaceId, parseBody(request, createTaskLabelRequestSchema));
    return reply.status(201).send(result);
  };

  updateLabel = async (request: FastifyRequest) => {
    const { labelId, workspaceId } = parseParams(request, labelParamsSchema);
    return this.workService.updateLabel(await requireAuth(request), workspaceId, labelId, parseBody(request, updateTaskLabelRequestSchema));
  };

  deleteLabel = async (request: FastifyRequest) => {
    const { labelId, workspaceId } = parseParams(request, labelParamsSchema);
    return this.workService.deleteLabel(await requireAuth(request), workspaceId, labelId);
  };

  listTaskLabels = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listTaskLabels(await requireAuth(request), workspaceId, taskId);
  };

  assignTaskLabel = async (request: FastifyRequest) => {
    const { labelId, taskId, workspaceId } = parseParams(request, taskLabelParamsSchema);
    return this.workService.assignTaskLabel(await requireAuth(request), workspaceId, taskId, labelId);
  };

  unassignTaskLabel = async (request: FastifyRequest) => {
    const { labelId, taskId, workspaceId } = parseParams(request, taskLabelParamsSchema);
    return this.workService.unassignTaskLabel(await requireAuth(request), workspaceId, taskId, labelId);
  };

  listTaskDependencies = async (request: FastifyRequest) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    return this.workService.listTaskDependencies(await requireAuth(request), workspaceId, taskId);
  };

  listProjectDependencyMap = async (request: FastifyRequest) => {
    const { projectId, workspaceId } = parseParams(request, projectParamsSchema);
    return this.workService.listProjectDependencyMap(await requireAuth(request), workspaceId, projectId);
  };

  addTaskDependency = async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId, workspaceId } = parseParams(request, taskParamsSchema);
    const result = await this.workService.addTaskDependency(await requireAuth(request), workspaceId, taskId, parseBody(request, addTaskDependencyRequestSchema));
    return reply.status(201).send(result);
  };

  removeTaskDependency = async (request: FastifyRequest) => {
    const { dependencyId, workspaceId } = parseParams(request, taskDependencyParamsSchema);
    return this.workService.removeTaskDependency(await requireAuth(request), workspaceId, dependencyId);
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

  createAttachmentComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    const result = await this.workService.createAttachmentComment(
      await requireAuth(request),
      workspaceId,
      attachmentId,
      parseBody(request, createAttachmentCommentRequestSchema),
    );
    return reply.status(201).send(result);
  };

  listAttachmentComments = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.listAttachmentComments(
      await requireAuth(request),
      workspaceId,
      attachmentId,
      parseQuery(request, cursorPaginationQuerySchema),
    );
  };

  updateAttachmentComment = async (request: FastifyRequest) => {
    const { attachmentCommentId, workspaceId } = parseParams(request, attachmentCommentParamsSchema);
    return this.workService.updateAttachmentComment(
      await requireAuth(request),
      workspaceId,
      attachmentCommentId,
      parseBody(request, updateAttachmentCommentRequestSchema),
    );
  };

  deleteAttachmentComment = async (request: FastifyRequest) => {
    const { attachmentCommentId, workspaceId } = parseParams(request, attachmentCommentParamsSchema);
    return this.workService.deleteAttachmentComment(await requireAuth(request), workspaceId, attachmentCommentId);
  };

  getAttachmentDownload = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.getAttachmentDownload(await requireAuth(request), workspaceId, attachmentId);
  };

  completeAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.completeAttachment(await requireAuth(request), workspaceId, attachmentId);
  };

  createAttachmentVersion = async (request: FastifyRequest, reply: FastifyReply) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    const result = await this.workService.createAttachmentVersion(await requireAuth(request), workspaceId, attachmentId, parseBody(request, replaceAttachmentRequestSchema));
    return reply.status(201).send(result);
  };

  completeAttachmentVersion = async (request: FastifyRequest) => {
    const { attachmentId, versionId, workspaceId } = parseParams(request, attachmentVersionParamsSchema);
    return this.workService.completeAttachmentVersion(await requireAuth(request), workspaceId, attachmentId, versionId);
  };

  updateAttachment = async (request: FastifyRequest) => {
    const { attachmentId, workspaceId } = parseParams(request, attachmentParamsSchema);
    return this.workService.updateAttachment(await requireAuth(request), workspaceId, attachmentId, parseBody(request, updateAttachmentRequestSchema));
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

  getNotificationPreferences = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.getNotificationPreferences(await requireAuth(request), workspaceId);
  };

  updateNotificationPreferences = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.updateNotificationPreferences(
      await requireAuth(request),
      workspaceId,
      parseBody(request, updateNotificationPreferenceRequestSchema),
    );
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
