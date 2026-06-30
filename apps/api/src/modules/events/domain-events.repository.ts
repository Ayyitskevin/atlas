import type { Prisma, PrismaClient } from "@atlas/db";
import type { DomainEventType } from "@atlas/shared";

import { realtimeHub } from "../../realtime/realtime.hub.js";

export class DomainEventsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordActivity(input: {
    actorUserId: string;
    entityId: string;
    entityType: string;
    eventType: DomainEventType;
    payload?: Prisma.InputJsonValue;
    projectId?: string;
    taskId?: string;
    version?: number;
    workspaceId: string;
  }) {
    const event = await this.prisma.$transaction(async (tx) => {
      const activityEvent = await tx.activityEvent.create({
        data: {
          actorUserId: input.actorUserId,
          entityId: input.entityId,
          entityType: input.entityType,
          eventType: input.eventType,
          payload: input.payload ?? {},
          projectId: input.projectId,
          taskId: input.taskId,
          workspaceId: input.workspaceId,
        },
      });

      await tx.domainEventOutbox.create({
        data: {
          eventId: activityEvent.id,
          eventType: input.eventType,
          payload: {
            actorUserId: input.actorUserId,
            entityId: input.entityId,
            entityType: input.entityType,
            eventId: activityEvent.id,
            eventType: input.eventType,
            occurredAt: activityEvent.createdAt.toISOString(),
            payload: input.payload ?? {},
            projectId: input.projectId ?? null,
            taskId: input.taskId ?? null,
            version: input.version ?? 0,
            workspaceId: input.workspaceId,
          },
        },
      });

      return activityEvent;
    });

    const payload = { event, type: input.eventType };
    realtimeHub.broadcastWorkspace(input.workspaceId, payload);
    if (input.projectId) realtimeHub.broadcastProject(input.projectId, payload);
    if (input.taskId) realtimeHub.broadcastTask(input.taskId, payload);
    return event;
  }
}
