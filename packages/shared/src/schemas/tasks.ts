import { z } from "zod";

import { taskPrioritySchema, taskStatusSchema } from "../domain.js";

export const createTaskRequestSchema = z.object({
  assigneeIds: z.array(z.string().uuid()).default([]),
  description: z.string().max(20000).optional(),
  dueDate: z.string().date().optional(),
  position: z.number().finite().optional(),
  priority: taskPrioritySchema.default("MEDIUM"),
  sectionId: z.string().uuid(),
  title: z.string().min(1).max(500),
});

export const updateTaskRequestSchema = z.object({
  description: z.string().max(20000).optional(),
  dueDate: z.string().date().nullable().optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  title: z.string().min(1).max(500).optional(),
  version: z.number().int().nonnegative(),
});

export const moveTaskRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(200).optional(),
  position: z.number().finite(),
  sectionId: z.string().uuid(),
  version: z.number().int().nonnegative(),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type MoveTaskRequest = z.infer<typeof moveTaskRequestSchema>;
