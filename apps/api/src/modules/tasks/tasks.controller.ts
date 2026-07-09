import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  createTaskRequestSchema,
  moveTaskRequestSchema,
  myWorkQuerySchema,
  projectTaskQuerySchema,
  taskWatcherUserRequestSchema,
  updateTaskRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const projectParamsSchema = workspaceParamsSchema.extend({ projectId: z.string().uuid() });
const taskParamsSchema = workspaceParamsSchema.extend({ taskId: z.string().uuid() });
const taskWatcherParamsSchema = taskParamsSchema.extend({ userId: z.string().uuid() });
const userBodySchema = z.object({ userId: z.string().uuid() });

export class TasksController {
  constructor(private readonly workService: WorkService) {}

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
}
