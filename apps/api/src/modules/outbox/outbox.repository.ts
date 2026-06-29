import type { DomainEventOutbox, Prisma, PrismaClient } from "@atlas/db";

import { paginationArgs } from "../../shared/pagination.js";

export type OutboxEventStatus = "pending" | "failed" | "processed" | "locked" | "all";

export class OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list(input: { cursor?: string; eventType?: string; limit: number; status: OutboxEventStatus; workspaceId: string }) {
    return this.prisma.domainEventOutbox.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        ...this.statusWhere(input.status),
        eventType: input.eventType,
        ...this.workspaceWhere(input.workspaceId),
      },
    });
  }

  findById(workspaceId: string, outboxEventId: string) {
    return this.prisma.domainEventOutbox.findFirst({
      where: {
        id: outboxEventId,
        ...this.workspaceWhere(workspaceId),
      },
    });
  }

  async replayFailed(workspaceId: string, outboxEventId: string) {
    const result = await this.prisma.domainEventOutbox.updateMany({
      data: {
        attempts: 0,
        failedAt: null,
        lastError: null,
        lockedAt: null,
        nextAttemptAt: new Date(),
        processedAt: null,
      },
      where: {
        failedAt: { not: null },
        id: outboxEventId,
        processedAt: null,
        ...this.workspaceWhere(workspaceId),
      },
    });
    if (result.count === 0) return null;
    return this.findById(workspaceId, outboxEventId);
  }

  private statusWhere(status: OutboxEventStatus): Prisma.DomainEventOutboxWhereInput {
    const now = new Date();
    if (status === "failed") return { failedAt: { not: null } };
    if (status === "processed") return { processedAt: { not: null } };
    if (status === "locked") return { failedAt: null, lockedAt: { not: null }, processedAt: null };
    if (status === "pending") {
      return {
        failedAt: null,
        lockedAt: null,
        processedAt: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      };
    }
    return {};
  }

  private workspaceWhere(workspaceId: string): Prisma.DomainEventOutboxWhereInput {
    return {
      payload: {
        equals: workspaceId,
        path: ["workspaceId"],
      },
    };
  }
}

export function outboxStatus(event: DomainEventOutbox): Exclude<OutboxEventStatus, "all"> {
  if (event.processedAt) return "processed";
  if (event.failedAt) return "failed";
  if (event.lockedAt) return "locked";
  return "pending";
}
