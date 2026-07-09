import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  notificationQuerySchema,
  updateNotificationPreferenceRequestSchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseBody, parseParams, parseQuery } from "../../shared/validation.js";
import { NotificationsService } from "./notifications.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  listNotifications = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.service.listNotifications(await requireAuth(request), workspaceId, parseQuery(request, notificationQuerySchema));
  };
  getNotificationPreferences = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.service.getNotificationPreferences(await requireAuth(request), workspaceId);
  };
  updateNotificationPreferences = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.service.updateNotificationPreferences(
      await requireAuth(request),
      workspaceId,
      parseBody(request, updateNotificationPreferenceRequestSchema),
    );
  };
  markNotificationRead = async (request: FastifyRequest) => {
    const { notificationId, workspaceId } = parseParams(request, notificationParamsSchema);
    return this.service.markNotificationRead(await requireAuth(request), workspaceId, notificationId);
  };
  markAllNotificationsRead = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.service.markAllNotificationsRead(await requireAuth(request), workspaceId);
  };
}
