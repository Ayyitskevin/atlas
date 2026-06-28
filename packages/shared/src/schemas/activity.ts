import { z } from "zod";

import { cursorPaginationQuerySchema } from "../pagination.js";

export const activityQuerySchema = cursorPaginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
