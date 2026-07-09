import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  notificationQuerySchema,
  updateNotificationPreferenceRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });

export class NotificationsController {
  constructor(private readonly workService: WorkService) {}

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
}
