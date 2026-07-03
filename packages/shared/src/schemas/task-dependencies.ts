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

export const projectDependencyMapNodeSchema = z.object({
  dependencySummary: taskDependencySummarySchema,
  dueDate: z.string().date().nullable(),
  id: z.string().uuid(),
  priority: taskPrioritySchema,
  sectionId: z.string().uuid(),
  status: taskStatusSchema,
  title: z.string(),
});

export const projectDependencyMapEdgeSchema = z.object({
  blockedTaskId: z.string().uuid(),
  blockingTaskId: z.string().uuid(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

export const projectDependencyMapStatsSchema = z.object({
  blockedTaskCount: z.number().int().nonnegative(),
  blockingTaskCount: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
  openEdgeCount: z.number().int().nonnegative(),
  readyBlockerCount: z.number().int().nonnegative(),
});

export const projectDependencyMapResponseSchema = z.object({
  criticalPathTaskIds: z.array(z.string().uuid()),
  edges: z.array(projectDependencyMapEdgeSchema),
  nodes: z.array(projectDependencyMapNodeSchema),
  stats: projectDependencyMapStatsSchema,
});

export type AddTaskDependencyRequest = z.infer<typeof addTaskDependencyRequestSchema>;
export type ProjectDependencyMapResponse = z.infer<typeof projectDependencyMapResponseSchema>;
export type TaskDependencyEdge = z.infer<typeof taskDependencyEdgeSchema>;
export type TaskDependenciesResponse = z.infer<typeof taskDependenciesResponseSchema>;
export type TaskDependencySummary = z.infer<typeof taskDependencySummarySchema>;
