import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { DomainEventOutbox } from "@atlas/db";

import type { OutboxRepository } from "../../src/modules/outbox/outbox.repository.js";
import { OutboxService } from "../../src/modules/outbox/outbox.service.js";
import type { PermissionsService } from "../../src/modules/permissions/permissions.service.js";
import type { AuthContext } from "../../src/shared/auth-context.js";

const workspaceId = randomUUID();
const ctx: AuthContext = {
  ip: "127.0.0.1",
  sessionId: randomUUID(),
  userId: randomUUID(),
};

describe("OutboxService", () => {
  it("returns failed event detail with operator context and raw payload", async () => {
    const occurredAt = new Date().toISOString();
    const entityId = randomUUID();
    const projectId = randomUUID();
    const taskId = randomUUID();
    const event = outboxEvent({
      payload: {
        actorUserId: ctx.userId,
        entityId,
        entityType: "task",
        eventId: randomUUID(),
        eventType: "TaskUpdated",
        occurredAt,
        payload: { source: "unit-test" },
        projectId,
        taskId,
        version: 7,
        workspaceId,
      },
    });
    const service = serviceFor(event);

    await expect(service.get(ctx, workspaceId, event.id)).resolves.toMatchObject({
      context: {
        actorUserId: ctx.userId,
        entityId,
        entityType: "task",
        occurredAt,
        projectId,
        taskId,
        version: 7,
      },
      payload: {
        payload: { source: "unit-test" },
        workspaceId,
      },
      status: "failed",
      workspaceId,
    });
  });

  it("keeps malformed payloads inspectable while nulling invalid context fields", async () => {
    const event = outboxEvent({
      payload: {
        actorUserId: "not-a-uuid",
        entityId: "also-not-a-uuid",
        entityType: "task",
        occurredAt: "not-a-date",
        projectId: "bad-project",
        taskId: "bad-task",
        version: -1,
        workspaceId,
      },
    });
    const service = serviceFor(event);

    await expect(service.get(ctx, workspaceId, event.id)).resolves.toMatchObject({
      context: {
        actorUserId: null,
        entityId: null,
        entityType: "task",
        occurredAt: null,
        projectId: null,
        taskId: null,
        version: null,
      },
      payload: {
        actorUserId: "not-a-uuid",
        workspaceId,
      },
    });
  });
});

function serviceFor(event: DomainEventOutbox): OutboxService {
  return new OutboxService(
    {
      findById: async () => event,
      list: async () => [event],
      replayFailed: async () => event,
    } as unknown as OutboxRepository,
    {
      requireWorkspaceRole: async () => "ADMIN",
    } as unknown as PermissionsService,
  );
}

function outboxEvent(input: { payload: DomainEventOutbox["payload"] }): DomainEventOutbox {
  const now = new Date();
  return {
    attempts: 10,
    createdAt: now,
    eventId: randomUUID(),
    eventType: "TaskUpdated",
    failedAt: now,
    id: randomUUID(),
    lastError: "Queue unavailable",
    lockedAt: null,
    nextAttemptAt: null,
    payload: input.payload,
    processedAt: null,
    updatedAt: now,
  };
}
