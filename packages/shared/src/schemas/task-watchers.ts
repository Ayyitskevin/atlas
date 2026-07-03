import { z } from "zod";

export const taskWatcherUserRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const taskWatcherUserSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

export const taskWatcherResponseSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  user: taskWatcherUserSchema,
  userId: z.string().uuid(),
  watchedById: z.string().uuid().nullable().optional(),
  workspaceId: z.string().uuid(),
});

export type TaskWatcherResponse = z.infer<typeof taskWatcherResponseSchema>;
export type TaskWatcherUserRequest = z.infer<typeof taskWatcherUserRequestSchema>;
