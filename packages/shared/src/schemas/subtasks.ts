import { z } from "zod";

import { taskStatusSchema } from "../domain.js";

export const createSubtaskRequestSchema = z.object({
  assigneeId: z.string().uuid().nullable().optional(),
  position: z.number().finite().optional(),
  title: z.string().min(1).max(500),
});

export const updateSubtaskRequestSchema = z.object({
  assigneeId: z.string().uuid().nullable().optional(),
  status: taskStatusSchema.optional(),
  title: z.string().min(1).max(500).optional(),
  version: z.number().int().nonnegative(),
});

export type CreateSubtaskRequest = z.infer<typeof createSubtaskRequestSchema>;
export type UpdateSubtaskRequest = z.infer<typeof updateSubtaskRequestSchema>;
