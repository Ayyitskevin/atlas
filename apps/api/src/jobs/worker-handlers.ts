import { taskNotificationCopy } from "./notification-copy.js";
import { WORKER_QUEUE_NAMES, type WorkerQueueName } from "./queue-names.js";
import type { MutationEventJob } from "./queues.js";

type TaskWithAssignees = {
  assignees: Array<{ userId: string }>;
  id: string;
  title: string;
};

export type NotificationFanoutStore = {
  notification: {
    createMany(input: {
      data: Array<{
        body: string;
        recipientId: string;
        taskId: string;
        title: string;
        type: string;
        workspaceId: string;
      }>;
      skipDuplicates: boolean;
    }): Promise<{ count: number }>;
  };
  task: {
    findFirst(input: { include: { assignees: true }; where: { id: string; workspaceId: string } }): Promise<TaskWithAssignees | null>;
  };
};

export type WorkerJobLike = {
  data: MutationEventJob;
  log(message: string): Promise<unknown> | unknown;
};

export type WorkerOutcome = {
  entityId: string;
  entityType: string;
  eventId: string;
  eventType: string;
  provider?: string;
  queue: WorkerQueueName;
  reason?: string;
  recipientCount?: number;
  status: "delivered" | "skipped" | "stubbed";
  workspaceId: string;
};

export async function handleNotificationFanoutJob(job: WorkerJobLike, store: NotificationFanoutStore): Promise<WorkerOutcome> {
  const event = job.data;
  if (!event.taskId) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "Event has no task scope."));
  }

  const task = await store.task.findFirst({
    include: { assignees: true },
    where: { id: event.taskId, workspaceId: event.workspaceId },
  });
  if (!task) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "Task no longer exists."));
  }

  const recipients = task.assignees.filter((assignee) => assignee.userId !== event.actorUserId);
  if (!recipients.length) {
    return recordWorkerOutcome(job, {
      ...baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "No eligible task assignees."),
      recipientCount: 0,
    });
  }

  const copy = taskNotificationCopy(event, task.title);
  const result = await store.notification.createMany({
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
  return recordWorkerOutcome(job, {
    ...baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "delivered"),
    recipientCount: result.count,
  });
}

export async function handleSearchIndexJob(job: WorkerJobLike): Promise<WorkerOutcome> {
  return recordWorkerOutcome(job, {
    ...baseOutcome(
      WORKER_QUEUE_NAMES.searchIndex,
      job.data,
      "stubbed",
      "Search is currently served by direct workspace-scoped database queries; no external index provider is configured.",
    ),
    provider: "database-search",
  });
}

export async function handleEmailStubJob(job: WorkerJobLike): Promise<WorkerOutcome> {
  return recordWorkerOutcome(job, {
    ...baseOutcome(WORKER_QUEUE_NAMES.emailStub, job.data, "stubbed", "No email provider is configured; delivery intentionally skipped."),
    provider: "none",
  });
}

async function recordWorkerOutcome(job: WorkerJobLike, outcome: WorkerOutcome): Promise<WorkerOutcome> {
  await job.log(JSON.stringify(outcome));
  return outcome;
}

function baseOutcome(queue: WorkerQueueName, event: MutationEventJob, status: WorkerOutcome["status"], reason?: string): WorkerOutcome {
  return {
    entityId: event.entityId,
    entityType: event.entityType,
    eventId: event.eventId,
    eventType: event.eventType,
    queue,
    reason,
    status,
    workspaceId: event.workspaceId,
  };
}
