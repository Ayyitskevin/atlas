import { z } from "zod";

import { taskPrioritySchema, taskRecurrenceFrequencySchema, taskStatusSchema } from "../domain.js";
import { cursorPaginationQuerySchema } from "../pagination.js";

const taskRecurrenceIntervalSchema = z.number().int().min(1).max(365);

export const createTaskRequestSchema = z.object({
  assigneeIds: z.array(z.string().uuid()).default([]),
  description: z.string().max(20000).optional(),
  dueDate: z.string().date().optional(),
  position: z.number().finite().optional(),
  priority: taskPrioritySchema.default("MEDIUM"),
  recurrenceFrequency: taskRecurrenceFrequencySchema.optional(),
  recurrenceInterval: taskRecurrenceIntervalSchema.optional(),
  sectionId: z.string().uuid(),
  title: z.string().min(1).max(500),
});

export const updateTaskRequestSchema = z.object({
  description: z.string().max(20000).optional(),
  dueDate: z.string().date().nullable().optional(),
  priority: taskPrioritySchema.optional(),
  recurrenceFrequency: taskRecurrenceFrequencySchema.nullable().optional(),
  recurrenceInterval: taskRecurrenceIntervalSchema.nullable().optional(),
  recurrencePaused: z.boolean().optional(),
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

export const myWorkStatusFilterSchema = z.enum(["open", "done", "all"]);
export const myWorkDueFilterSchema = z.enum(["any", "overdue", "today", "next7", "unscheduled"]);
export const myWorkScopeFilterSchema = z.enum(["assigned", "watching", "all"]);
export const taskDependencyFilterSchema = z.enum(["any", "blocked", "blocking"]);
export const myWorkDependencyFilterSchema = taskDependencyFilterSchema;

export const projectTaskQuerySchema = cursorPaginationQuerySchema.extend({
  dependency: taskDependencyFilterSchema.default("any"),
});

export const myWorkQuerySchema = cursorPaginationQuerySchema.extend({
  dependency: myWorkDependencyFilterSchema.default("any"),
  due: myWorkDueFilterSchema.default("any"),
  scope: myWorkScopeFilterSchema.default("assigned"),
  status: myWorkStatusFilterSchema.default("open"),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type MoveTaskRequest = z.infer<typeof moveTaskRequestSchema>;
export type MyWorkDependencyFilter = z.infer<typeof myWorkDependencyFilterSchema>;
export type MyWorkDueFilter = z.infer<typeof myWorkDueFilterSchema>;
export type MyWorkQuery = z.infer<typeof myWorkQuerySchema>;
export type MyWorkScopeFilter = z.infer<typeof myWorkScopeFilterSchema>;
export type MyWorkStatusFilter = z.infer<typeof myWorkStatusFilterSchema>;
export type ProjectTaskQuery = z.infer<typeof projectTaskQuerySchema>;
export type TaskDependencyFilter = z.infer<typeof taskDependencyFilterSchema>;
