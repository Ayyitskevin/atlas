import { z } from "zod";

import { projectVisibilitySchema, taskPrioritySchema, taskStatusSchema } from "../domain.js";
import { cursorPaginationQuerySchema, pageInfoSchema } from "../pagination.js";

export const searchResultTypeSchema = z.enum(["project", "task"]);

export const searchCursorSchema = z.object({
  id: z.string().uuid(),
  type: searchResultTypeSchema,
  updatedAt: z.string().datetime(),
});

export const searchQuerySchema = cursorPaginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200),
  type: searchResultTypeSchema.optional(),
});

const searchableProjectSchema = z.object({
  archivedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  description: z.string().nullable().optional(),
  id: z.string().uuid(),
  name: z.string(),
  updatedAt: z.string().datetime().optional(),
  visibility: projectVisibilitySchema,
}).passthrough();

const searchableTaskSchema = z.object({
  completedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  id: z.string().uuid(),
  position: z.union([z.number(), z.string()]).optional(),
  priority: taskPrioritySchema,
  projectId: z.string().uuid(),
  sectionId: z.string().uuid(),
  status: taskStatusSchema,
  title: z.string(),
  updatedAt: z.string().datetime().optional(),
  version: z.number().int().nonnegative(),
}).passthrough();

export const searchResultSchema = z.discriminatedUnion("type", [
  z.object({ project: searchableProjectSchema, type: z.literal("project") }),
  z.object({ task: searchableTaskSchema, type: z.literal("task") }),
]);

export const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  pageInfo: pageInfoSchema,
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchCursor = z.infer<typeof searchCursorSchema>;
export type SearchResultType = z.infer<typeof searchResultTypeSchema>;
