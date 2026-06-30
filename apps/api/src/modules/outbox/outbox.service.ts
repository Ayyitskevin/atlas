import type { DomainEventOutbox, DomainEventOutboxAttempt } from "@atlas/db";
import { ATLAS_ERROR_CODES, type OutboxQuery } from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { type OutboxEventDetail, OutboxRepository, outboxStatus } from "./outbox.repository.js";

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

  async get(ctx: AuthContext, workspaceId: string, outboxEventId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const event = await this.outboxRepository.findDetailById(workspaceId, outboxEventId);
    if (!event) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Outbox event not found.");
    return toOutboxEventDetailResponse(event);
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

function toOutboxEventResponse(event: DomainEventOutbox) {
  const payload = event.payload;
  const workspaceId =
    typeof payload === "object" && payload && !Array.isArray(payload) && "workspaceId" in payload ? payload.workspaceId : null;

  const canReplay = Boolean(event.failedAt && !event.processedAt);

  return {
    attempts: event.attempts,
    canReplay,
    createdAt: event.createdAt.toISOString(),
    deadLettered: Boolean(event.failedAt),
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

function toOutboxEventDetailResponse(event: OutboxEventDetail) {
  return {
    ...toOutboxEventResponse(event),
    attemptHistory: event.attemptsLog.map(toOutboxAttemptResponse),
    context: outboxEventContext(event.payload),
    payload: event.payload,
  };
}

function toOutboxAttemptResponse(attempt: DomainEventOutboxAttempt) {
  return {
    attemptNumber: attempt.attemptNumber,
    createdAt: attempt.createdAt.toISOString(),
    error: attempt.error,
    finishedAt: attempt.finishedAt.toISOString(),
    id: attempt.id,
    startedAt: attempt.startedAt.toISOString(),
    status: attempt.status,
  };
}

function outboxEventContext(payload: unknown) {
  const event = isObject(payload) ? payload : {};
  return {
    actorUserId: uuidValue(event.actorUserId),
    entityId: uuidValue(event.entityId),
    entityType: stringValue(event.entityType),
    occurredAt: dateTimeValue(event.occurredAt),
    projectId: uuidValue(event.projectId),
    taskId: uuidValue(event.taskId),
    version: typeof event.version === "number" && Number.isInteger(event.version) && event.version >= 0 ? event.version : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function uuidValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value) ? value : null;
}

function dateTimeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}
