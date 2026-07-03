import { Worker } from "bullmq";

import { prisma } from "@atlas/db";

import { env } from "../config/env.js";
import { startOutboxDispatcher } from "./outbox.js";
import { WORKER_QUEUE_NAMES } from "./queue-names.js";
import { queueConnection, type MutationEventJob } from "./queues.js";
import {
  handleEmailStubJob,
  handleNotificationFanoutJob,
  handleSearchIndexJob,
  type WorkerOutcome,
} from "./worker-handlers.js";

export function startWorkers() {
  const notificationWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.notificationFanout,
    async (job) => handleNotificationFanoutJob(job, prisma),
    { connection: queueConnection },
  );

  const searchWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.searchIndex,
    handleSearchIndexJob,
    { connection: queueConnection },
  );

  const emailWorker = new Worker<MutationEventJob, WorkerOutcome, string>(
    WORKER_QUEUE_NAMES.emailStub,
    handleEmailStubJob,
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

  console.info({ redis: env.REDIS_URL }, "Atlas workers started");
  return [notificationWorker, searchWorker, emailWorker, outboxDispatcher];
}
