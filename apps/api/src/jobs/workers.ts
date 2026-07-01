import { Worker } from "bullmq";

import { prisma } from "@atlas/db";

import { env } from "../config/env.js";
import { taskNotificationCopy } from "./notification-copy.js";
import { startOutboxDispatcher } from "./outbox.js";
import { queueConnection, type MutationEventJob } from "./queues.js";

export function startWorkers() {
  const notificationWorker = new Worker<MutationEventJob, void, string>(
    "atlas-notification-fanout",
    async (job) => {
      const event = job.data;
      if (!event.taskId) return;
      const task = await prisma.task.findFirst({
        include: { assignees: true },
        where: { id: event.taskId, workspaceId: event.workspaceId },
      });
      if (!task) return;
      const recipients = task.assignees.filter((assignee) => assignee.userId !== event.actorUserId);
      const copy = taskNotificationCopy(event, task.title);
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          body: copy.body,
          recipientId: recipient.userId,
          taskId: task.id,
          title: copy.title,
          type: `task.${event.eventType}`,
          workspaceId: event.workspaceId,
        })),
        skipDuplicates: true,
      });
    },
    { connection: queueConnection },
  );

  const searchWorker = new Worker<MutationEventJob, void, string>(
    "atlas-search-index",
    async (job) => {
      job.log(`Search index update stub for ${job.data.entityType}:${job.data.entityId}`);
    },
    { connection: queueConnection },
  );

  const emailWorker = new Worker<MutationEventJob, void, string>(
    "atlas-email-stub",
    async (job) => {
      job.log(`Email delivery stub for event ${job.data.eventId}`);
    },
    { connection: queueConnection },
  );

  for (const worker of [notificationWorker, searchWorker, emailWorker]) {
    worker.on("failed", (job, error) => {
      console.error({ error, jobId: job?.id, queue: worker.name }, "Atlas worker job failed");
    });
  }

  const outboxDispatcher = startOutboxDispatcher();

  console.info({ redis: env.REDIS_URL }, "Atlas workers started");
  return [notificationWorker, searchWorker, emailWorker, outboxDispatcher];
}
