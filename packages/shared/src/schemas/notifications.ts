import { z } from "zod";

import { cursorPaginationQuerySchema } from "../pagination.js";

export const notificationQuerySchema = cursorPaginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
