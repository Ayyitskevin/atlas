import { ATLAS_ERROR_CODES, type OutboxQuery } from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { OutboxRepository, outboxStatus } from "./outbox.repository.js";

export class OutboxService {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async list(ctx: AuthContext, workspaceId: string, query: OutboxQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const events = await this.outboxRepository.list({ ...query, workspaceId });
    return pageFromLimit(events.map(toOutboxEventResponse), query.limit);
  }

  async replay(ctx: AuthContext, workspaceId: string, outboxEventId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const event = await this.outboxRepository.findById(workspaceId, outboxEventId);
    if (!event) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Outbox event not found.");
    if (!event.failedAt) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Only failed outbox events can be replayed.");
    }

    const replayed = await this.outboxRepository.replayFailed(workspaceId, outboxEventId);
    if (!replayed) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Outbox event can no longer be replayed.");
    return { event: toOutboxEventResponse(replayed), replayQueued: true };
  }
}

function toOutboxEventResponse(event: Parameters<typeof outboxStatus>[0]) {
  const payload = event.payload;
  const workspaceId =
    typeof payload === "object" && payload && !Array.isArray(payload) && "workspaceId" in payload ? payload.workspaceId : null;

  return {
    attempts: event.attempts,
    createdAt: event.createdAt.toISOString(),
    eventId: event.eventId,
    eventType: event.eventType,
    failedAt: event.failedAt?.toISOString() ?? null,
    id: event.id,
    lastError: event.lastError,
    lockedAt: event.lockedAt?.toISOString() ?? null,
    nextAttemptAt: event.nextAttemptAt?.toISOString() ?? null,
    processedAt: event.processedAt?.toISOString() ?? null,
    status: outboxStatus(event),
    updatedAt: event.updatedAt.toISOString(),
    workspaceId: typeof workspaceId === "string" ? workspaceId : null,
  };
}
