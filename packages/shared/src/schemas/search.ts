import { z } from "zod";

import { cursorPaginationQuerySchema } from "../pagination.js";

export const searchQuerySchema = cursorPaginationQuerySchema.extend({
  q: z.string().min(1).max(200),
  type: z.string().optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
