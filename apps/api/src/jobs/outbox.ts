import type { DomainEventOutbox } from "@atlas/db";
import { prisma } from "@atlas/db";

import { enqueueDomainSideEffects, type MutationEventJob } from "./queues.js";

const dispatcherIntervalMs = 2_000;
const batchSize = 25;
const maxAttempts = 10;

export function startOutboxDispatcher() {
  const timer = setInterval(() => {
    void dispatchOutboxBatch().catch((error) => {
      console.error({ error }, "Atlas outbox dispatch failed");
    });
  }, dispatcherIntervalMs);

  void dispatchOutboxBatch().catch((error) => {
    console.error({ error }, "Atlas initial outbox dispatch failed");
  });

  return {
    close: () => clearInterval(timer),
  };
}

export async function dispatchOutboxBatch(limit = batchSize): Promise<void> {
  const now = new Date();
  const events = await prisma.domainEventOutbox.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
    where: {
      failedAt: null,
      lockedAt: null,
      processedAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
  });

  for (const event of events) {
    await dispatchOutboxEvent(event);
  }
}

export async function dispatchOutboxEvent(
  event: DomainEventOutbox,
  enqueue: (event: MutationEventJob) => Promise<void> = enqueueDomainSideEffects,
): Promise<void> {
  const startedAt = new Date();
  const locked = await prisma.domainEventOutbox.updateMany({
    data: { lockedAt: startedAt },
    where: { id: event.id, lockedAt: null, processedAt: null },
  });
  if (locked.count === 0) return;

  const lockedEvent = await prisma.domainEventOutbox.findUniqueOrThrow({ where: { id: event.id } });
  const attemptNumber = await nextAttemptNumber(event.id);

  try {
    await enqueue(lockedEvent.payload as unknown as MutationEventJob);
    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.domainEventOutbox.update({
        data: { failedAt: null, lastError: null, lockedAt: null, nextAttemptAt: null, processedAt: finishedAt },
        where: { id: event.id },
      }),
      prisma.domainEventOutboxAttempt.create({
        data: {
          attemptNumber,
          finishedAt,
          outboxEventId: event.id,
          startedAt,
          status: "succeeded",
        },
      }),
    ]);
  } catch (error) {
    const attempts = lockedEvent.attempts + 1;
    const finishedAt = new Date();
    const lastError = error instanceof Error ? error.message : "Unknown outbox dispatch error.";
    await prisma.$transaction([
      prisma.domainEventOutbox.update({
        data: {
          attempts,
          failedAt: attempts >= maxAttempts ? finishedAt : null,
          lastError,
          lockedAt: null,
          nextAttemptAt: attempts >= maxAttempts ? null : new Date(Date.now() + retryDelayMs(attempts)),
        },
        where: { id: event.id },
      }),
      prisma.domainEventOutboxAttempt.create({
        data: {
          attemptNumber,
          error: lastError,
          finishedAt,
          outboxEventId: event.id,
          startedAt,
          status: "failed",
        },
      }),
    ]);
  }
}

async function nextAttemptNumber(outboxEventId: string): Promise<number> {
  const result = await prisma.domainEventOutboxAttempt.aggregate({
    _max: { attemptNumber: true },
    where: { outboxEventId },
  });
  return (result._max.attemptNumber ?? 0) + 1;
}

function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** attempts);
}
