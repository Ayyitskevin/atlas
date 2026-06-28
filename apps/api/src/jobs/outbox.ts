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

async function dispatchOutboxEvent(event: DomainEventOutbox): Promise<void> {
  const locked = await prisma.domainEventOutbox.updateMany({
    data: { lockedAt: new Date() },
    where: { id: event.id, lockedAt: null, processedAt: null },
  });
  if (locked.count === 0) return;

  try {
    await enqueueDomainSideEffects(event.payload as unknown as MutationEventJob);
    await prisma.domainEventOutbox.update({
      data: { lastError: null, lockedAt: null, processedAt: new Date() },
      where: { id: event.id },
    });
  } catch (error) {
    const attempts = event.attempts + 1;
    await prisma.domainEventOutbox.update({
      data: {
        attempts,
        failedAt: attempts >= maxAttempts ? new Date() : null,
        lastError: error instanceof Error ? error.message : "Unknown outbox dispatch error.",
        lockedAt: null,
        nextAttemptAt: attempts >= maxAttempts ? null : new Date(Date.now() + retryDelayMs(attempts)),
      },
      where: { id: event.id },
    });
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** attempts);
}
