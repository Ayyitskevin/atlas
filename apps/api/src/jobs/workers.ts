import { Worker } from "bullmq";

import { prisma } from "@atlas/db";

import { env } from "../config/env.js";
import { createEmailProvider } from "../email/email-provider.js";
import { startOutboxDispatcher } from "./outbox.js";
import { WORKER_QUEUE_NAMES } from "./queue-names.js";
import { queueConnection, type MutationEventJob } from "./queues.js";
import {
  handleEmailDeliveryJob,
  handleNotificationFanoutJob,
  handleSearchIndexJob,
  type WorkerOutcome,
} from "./worker-handlers.js";

export function startWorkers() {
  const emailProvider = createEmailProvider({ from: env.EMAIL_FROM, provider: env.EMAIL_PROVIDER });
  const notificationWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.notificationFanout,
    async (job) => handleNotificationFanoutJob(job, prisma, prisma),
    { connection: queueConnection },
  );

  const searchWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.searchIndex,
    async (job) => handleSearchIndexJob(job, prisma),
    { connection: queueConnection },
  );

  const emailWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.emailDelivery,
    async (job) => handleEmailDeliveryJob(job, prisma, emailProvider, prisma),
    { connection: queueConnection },
  );

  for (const worker of [notificationWorker, searchWorker, emailWorker]) {
    worker.on("completed", (job, outcome) => {
      console.info({ jobId: job.id, outcome, queue: worker.name }, "Atlas worker job completed");
    });
    worker.on("failed", (job, error) => {
      console.error({ error, jobId: job?.id, queue: worker.name }, "Atlas worker job failed");
    });
  }

  const outboxDispatcher = startOutboxDispatcher();

  console.info({ emailProvider: emailProvider.name, redis: env.REDIS_URL }, "Atlas workers started");
  return [notificationWorker, searchWorker, emailWorker, outboxDispatcher];
}
