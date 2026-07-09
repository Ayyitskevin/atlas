import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  notificationPreferenceResponseSchema,
  notificationQuerySchema,
  updateNotificationPreferenceRequestSchema,
} from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { NotificationsController } from "./notifications.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const notificationParamsSchema = workspaceParamsSchema.extend({ notificationId: z.string().uuid() });

export async function registerNotificationsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new NotificationsController(createWorkService());

  app.get(
    "/workspaces/:workspaceId/notifications",
    {
      schema: openApiSchema({
        params: workspaceParamsSchema,
        querystring: notificationQuerySchema,
        tags: ["Notifications"],
      }),
    },
    controller.listNotifications,
  );
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
  app.post(
    "/workspaces/:workspaceId/notifications/:notificationId/read",
    { schema: openApiSchema({ params: notificationParamsSchema, tags: ["Notifications"] }) },
    controller.markNotificationRead,
  );
  app.post(
    "/workspaces/:workspaceId/notifications/read-all",
    { schema: openApiSchema({ params: workspaceParamsSchema, tags: ["Notifications"] }) },
    controller.markAllNotificationsRead,
  );
}
