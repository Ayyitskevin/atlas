import { z } from "zod";

import { taskPrioritySchema, taskStatusSchema } from "../domain.js";

export const addTaskDependencyRequestSchema = z.object({
  blockingTaskId: z.string().uuid(),
});

export const taskDependencySummarySchema = z.object({
  blockedByOpenCount: z.number().int().nonnegative(),
  blocksCount: z.number().int().nonnegative(),
  isBlocked: z.boolean(),
});

export const taskDependencyTaskSchema = z.object({
  assigneeCount: z.number().int().nonnegative().optional(),
  dependencySummary: taskDependencySummarySchema.optional(),
  dueDate: z.string().date().nullable().optional(),
  id: z.string().uuid(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema,
  title: z.string(),
});

export const taskDependencyEdgeSchema = z.object({
  blockedTaskId: z.string().uuid(),
  blockingTaskId: z.string().uuid(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  task: taskDependencyTaskSchema,
});

export const taskDependenciesResponseSchema = z.object({
  blockedBy: z.array(taskDependencyEdgeSchema),
  blocks: z.array(taskDependencyEdgeSchema),
  isBlocked: z.boolean(),
});

export type AddTaskDependencyRequest = z.infer<typeof addTaskDependencyRequestSchema>;
export type TaskDependencyEdge = z.infer<typeof taskDependencyEdgeSchema>;
export type TaskDependenciesResponse = z.infer<typeof taskDependenciesResponseSchema>;
export type TaskDependencySummary = z.infer<typeof taskDependencySummarySchema>;
