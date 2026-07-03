import { z } from "zod";

export const taskLabelColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Label color must be a hex color.");

export const createTaskLabelRequestSchema = z.object({
  color: taskLabelColorSchema.default("#64748b"),
  name: z.string().trim().min(1).max(40),
});

export const updateTaskLabelRequestSchema = z.object({
  color: taskLabelColorSchema.optional(),
  name: z.string().trim().min(1).max(40).optional(),
});

export const taskLabelResponseSchema = z.object({
  color: taskLabelColorSchema,
  createdAt: z.string().datetime().optional(),
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.string().datetime().optional(),
  workspaceId: z.string().uuid(),
});

export const taskLabelAssignmentResponseSchema = z.object({
  createdAt: z.string().datetime().optional(),
  id: z.string().uuid(),
  label: taskLabelResponseSchema,
  labelId: z.string().uuid(),
  taskId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export type CreateTaskLabelRequest = z.infer<typeof createTaskLabelRequestSchema>;
export type TaskLabelAssignmentResponse = z.infer<typeof taskLabelAssignmentResponseSchema>;
export type TaskLabelResponse = z.infer<typeof taskLabelResponseSchema>;
export type UpdateTaskLabelRequest = z.infer<typeof updateTaskLabelRequestSchema>;
