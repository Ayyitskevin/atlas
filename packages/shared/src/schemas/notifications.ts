import { z } from "zod";

import { cursorPaginationQuerySchema } from "../pagination.js";

export const notificationQuerySchema = cursorPaginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export const notificationPreferenceResponseSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.literal(true),
  updatedAt: z.string().datetime().nullable(),
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export const updateNotificationPreferenceRequestSchema = z.object({
  emailEnabled: z.boolean(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationPreferenceResponse = z.infer<typeof notificationPreferenceResponseSchema>;
export type UpdateNotificationPreferenceRequest = z.infer<typeof updateNotificationPreferenceRequestSchema>;
