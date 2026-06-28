import { Queue } from "bullmq";

import { env } from "../config/env.js";

export type MutationEventJob = {
  actorUserId: string;
  entityId: string;
  entityType: string;
  eventId: string;
  eventType: string;
  projectId?: string | null;
  taskId?: string | null;
  workspaceId: string;
};

const redisUrl = new URL(env.REDIS_URL);

export const queueConnection = {
  db: redisUrl.pathname.length > 1 ? Number(redisUrl.pathname.slice(1)) : 0,
  host: redisUrl.hostname,
  maxRetriesPerRequest: null,
  password: redisUrl.password || undefined,
  port: redisUrl.port ? Number(redisUrl.port) : 6379,
  username: redisUrl.username || undefined,
};

export const notificationFanoutQueue = new Queue<MutationEventJob, void, string>("atlas-notification-fanout", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { delay: 2000, type: "exponential" },
    removeOnComplete: 500,
    removeOnFail: false,
  },
});

export const searchIndexQueue = new Queue<MutationEventJob, void, string>("atlas-search-index", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 1000, type: "exponential" },
    removeOnComplete: 500,
    removeOnFail: false,
  },
});

export const emailStubQueue = new Queue<MutationEventJob, void, string>("atlas-email-stub", {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { delay: 5000, type: "exponential" },
    removeOnComplete: 500,
    removeOnFail: false,
  },
});

export async function enqueueDomainSideEffects(event: MutationEventJob): Promise<void> {
  await Promise.all([
    notificationFanoutQueue.add(event.eventType, event),
    searchIndexQueue.add(event.eventType, event),
    emailStubQueue.add(event.eventType, event),
  ]);
}
