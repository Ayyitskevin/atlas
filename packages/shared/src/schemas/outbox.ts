import { z } from "zod";

import { cursorPaginationQuerySchema } from "../pagination.js";

export const outboxStatusSchema = z.enum(["pending", "failed", "processed", "locked", "all"]);

export const outboxQuerySchema = cursorPaginationQuerySchema.extend({
  eventType: z.string().min(1).max(100).optional(),
  status: outboxStatusSchema.default("failed"),
});

export const outboxEventResponseSchema = z.object({
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  eventId: z.string().uuid(),
  eventType: z.string(),
  failedAt: z.string().datetime().nullable(),
  id: z.string().uuid(),
  lastError: z.string().nullable(),
  lockedAt: z.string().datetime().nullable(),
  nextAttemptAt: z.string().datetime().nullable(),
  processedAt: z.string().datetime().nullable(),
  status: outboxStatusSchema.exclude(["all"]),
  updatedAt: z.string().datetime(),
  workspaceId: z.string().uuid().nullable(),
});

export const outboxEventContextSchema = z.object({
  actorUserId: z.string().uuid().nullable(),
  entityId: z.string().uuid().nullable(),
  entityType: z.string().nullable(),
  occurredAt: z.string().datetime().nullable(),
  projectId: z.string().uuid().nullable(),
  taskId: z.string().uuid().nullable(),
  version: z.number().int().nonnegative().nullable(),
});

export const outboxEventDetailResponseSchema = outboxEventResponseSchema.extend({
  context: outboxEventContextSchema,
  payload: z.unknown(),
});

export const replayOutboxEventResponseSchema = z.object({
  event: outboxEventResponseSchema,
  replayQueued: z.boolean(),
});

export type OutboxQuery = z.infer<typeof outboxQuerySchema>;
