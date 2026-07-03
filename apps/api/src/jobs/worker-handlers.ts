import type { EmailDraft, EmailProvider } from "../email/email-provider.js";
import { taskNotificationCopy } from "./notification-copy.js";
import { WORKER_QUEUE_NAMES, type WorkerQueueName } from "./queue-names.js";
import type { MutationEventJob } from "./queues.js";

type TaskWithNotificationTargets = {
  assignees: Array<{ userId: string }>;
  id: string;
  title: string;
  watchers: Array<{ userId: string }>;
};

type TaskWithNotificationTargetUsers = {
  assignees: Array<{ user: { email: string; id: string; name: string } }>;
  id: string;
  title: string;
  watchers: Array<{ user: { email: string; id: string; name: string } }>;
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
    findFirst(input: { include: { assignees: true; watchers: true }; where: { id: string; workspaceId: string } }): Promise<TaskWithNotificationTargets | null>;
  };
};

export type EmailDeliveryStore = {
  task: {
    findFirst(input: {
      include: {
        assignees: { include: { user: { select: { email: true; id: true; name: true } } } };
        watchers: { include: { user: { select: { email: true; id: true; name: true } } } };
      };
      where: { id: string; workspaceId: string };
    }): Promise<TaskWithNotificationTargetUsers | null>;
  };
  workspaceNotificationPreference: {
    findMany(input: {
      select: { userId: true };
      where: { emailEnabled: true; userId: { in: string[] }; workspaceId: string };
    }): Promise<Array<{ userId: string }>>;
  };
};

export type WorkerJobLike = {
  data: MutationEventJob;
  id?: string;
  log(message: string): Promise<unknown> | unknown;
};

export type WorkerOutcome = {
  entityId: string;
  entityType: string;
  eventId: string;
  eventType: string;
  provider?: string;
  providerMessageId?: string;
  queue: WorkerQueueName;
  reason?: string;
  recipientCount?: number;
  status: "delivered" | "failed" | "skipped" | "stubbed";
  workspaceId: string;
};

export type WorkerOutcomePersistenceStore = {
  workerJobOutcome: {
    create(input: {
      data: {
        entityId: string;
        entityType: string;
        eventId: string;
        eventType: string;
        jobId?: string | null;
        provider?: string | null;
        providerMessageId?: string | null;
        queue: WorkerQueueName;
        reason?: string | null;
        recipientCount?: number | null;
        status: WorkerOutcome["status"];
        workspaceId: string;
      };
    }): Promise<unknown>;
  };
};

export async function handleNotificationFanoutJob(
  job: WorkerJobLike,
  store: NotificationFanoutStore,
  outcomeStore?: WorkerOutcomePersistenceStore,
): Promise<WorkerOutcome> {
  const event = job.data;
  if (!event.taskId) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "Event has no task scope."), outcomeStore);
  }

  const task = await store.task.findFirst({
    include: { assignees: true, watchers: true },
    where: { id: event.taskId, workspaceId: event.workspaceId },
  });
  if (!task) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "Task no longer exists."), outcomeStore);
  }

  const recipientIds = taskRecipientIds(task, event.actorUserId);
  if (!recipientIds.length) {
    return recordWorkerOutcome(
      job,
      {
        ...baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "skipped", "No eligible task assignees or watchers."),
        recipientCount: 0,
      },
      outcomeStore,
    );
  }

  const copy = taskNotificationCopy(event, task.title);
  const result = await store.notification.createMany({
    data: recipientIds.map((recipientId) => ({
      body: copy.body,
      recipientId,
      taskId: task.id,
      title: copy.title,
      type: `task.${event.eventType}`,
      workspaceId: event.workspaceId,
    })),
    skipDuplicates: true,
  });
  return recordWorkerOutcome(
    job,
    {
      ...baseOutcome(WORKER_QUEUE_NAMES.notificationFanout, event, "delivered"),
      recipientCount: result.count,
    },
    outcomeStore,
  );
}

export async function handleSearchIndexJob(job: WorkerJobLike, outcomeStore?: WorkerOutcomePersistenceStore): Promise<WorkerOutcome> {
  return recordWorkerOutcome(
    job,
    {
      ...baseOutcome(
        WORKER_QUEUE_NAMES.searchIndex,
        job.data,
        "stubbed",
        "Search is currently served by direct workspace-scoped database queries; no external index provider is configured.",
      ),
      provider: "database-search",
    },
    outcomeStore,
  );
}

export async function handleEmailDeliveryJob(
  job: WorkerJobLike,
  store: EmailDeliveryStore,
  emailProvider: EmailProvider,
  outcomeStore?: WorkerOutcomePersistenceStore,
): Promise<WorkerOutcome> {
  const event = job.data;
  if (!event.taskId) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.emailDelivery, event, "skipped", "Event has no task scope."), outcomeStore);
  }

  const task = await store.task.findFirst({
    include: {
      assignees: {
        include: { user: { select: { email: true, id: true, name: true } } },
      },
      watchers: {
        include: { user: { select: { email: true, id: true, name: true } } },
      },
    },
    where: { id: event.taskId, workspaceId: event.workspaceId },
  });
  if (!task) {
    return recordWorkerOutcome(job, baseOutcome(WORKER_QUEUE_NAMES.emailDelivery, event, "skipped", "Task no longer exists."), outcomeStore);
  }

  const eligibleRecipients = taskRecipientUsers(task, event.actorUserId);
  if (!eligibleRecipients.length) {
    return recordWorkerOutcome(
      job,
      {
        ...baseOutcome(WORKER_QUEUE_NAMES.emailDelivery, event, "skipped", "No eligible task assignees or watchers."),
        provider: emailProvider.name,
        recipientCount: 0,
      },
      outcomeStore,
    );
  }

  const optedInUserIds = new Set(
    (
      await store.workspaceNotificationPreference.findMany({
        select: { userId: true },
        where: {
          emailEnabled: true,
          userId: { in: eligibleRecipients.map((recipient) => recipient.id) },
          workspaceId: event.workspaceId,
        },
      })
    ).map((preference) => preference.userId),
  );
  const recipients = eligibleRecipients.filter((recipient) => optedInUserIds.has(recipient.id));
  if (!recipients.length) {
    return recordWorkerOutcome(
      job,
      {
        ...baseOutcome(WORKER_QUEUE_NAMES.emailDelivery, event, "skipped", "No task assignees or watchers have email notifications enabled."),
        provider: emailProvider.name,
        recipientCount: 0,
      },
      outcomeStore,
    );
  }

  try {
    const result = await emailProvider.send(taskEmailDraft(event, task, recipients));
    return recordWorkerOutcome(
      job,
      {
        ...baseOutcome(
          WORKER_QUEUE_NAMES.emailDelivery,
          event,
          result.stubbed ? "stubbed" : "delivered",
          result.stubbed ? "Email provider is configured for no-op delivery." : undefined,
        ),
        provider: result.provider,
        providerMessageId: result.providerMessageId,
        recipientCount: result.acceptedRecipientCount,
      },
      outcomeStore,
    );
  } catch (error) {
    const reason = errorMessage(error);
    await recordWorkerOutcome(
      job,
      {
        ...baseOutcome(WORKER_QUEUE_NAMES.emailDelivery, event, "failed", reason),
        provider: emailProvider.name,
        recipientCount: recipients.length,
      },
      outcomeStore,
    );
    throw error instanceof Error ? error : new Error(reason);
  }
}

async function recordWorkerOutcome(
  job: WorkerJobLike,
  outcome: WorkerOutcome,
  outcomeStore?: WorkerOutcomePersistenceStore,
): Promise<WorkerOutcome> {
  await job.log(JSON.stringify(outcome));
  if (outcomeStore) await persistWorkerOutcome(job, outcome, outcomeStore);
  return outcome;
}

async function persistWorkerOutcome(
  job: WorkerJobLike,
  outcome: WorkerOutcome,
  outcomeStore: WorkerOutcomePersistenceStore,
): Promise<void> {
  try {
    await outcomeStore.workerJobOutcome.create({
      data: {
        entityId: outcome.entityId,
        entityType: outcome.entityType,
        eventId: outcome.eventId,
        eventType: outcome.eventType,
        jobId: job.id ?? null,
        provider: outcome.provider ?? null,
        providerMessageId: outcome.providerMessageId ?? null,
        queue: outcome.queue,
        reason: outcome.reason ?? null,
        recipientCount: outcome.recipientCount ?? null,
        status: outcome.status,
        workspaceId: outcome.workspaceId,
      },
    });
  } catch (error) {
    const reason = errorMessage(error);
    await job.log(
      JSON.stringify({
        eventId: outcome.eventId,
        queue: outcome.queue,
        reason,
        status: "failed",
        type: "workerOutcomePersistenceFailed",
        workspaceId: outcome.workspaceId,
      }),
    );
    console.error({ error, outcome }, "Atlas worker outcome persistence failed");
  }
}

function taskEmailDraft(
  event: MutationEventJob,
  task: Pick<TaskWithNotificationTargetUsers, "id" | "title">,
  recipients: Array<{ email: string; name: string }>,
): EmailDraft {
  const copy = taskNotificationCopy(event, task.title);
  return {
    metadata: {
      eventId: event.eventId,
      eventType: event.eventType,
      taskId: task.id,
      workspaceId: event.workspaceId,
    },
    subject: "Atlas: " + copy.title,
    text: copy.body + "\n\nOpen Atlas to review the task.",
    to: recipients.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
    })),
  };
}

function taskRecipientIds(task: Pick<TaskWithNotificationTargets, "assignees" | "watchers">, actorUserId: string) {
  return [...new Set([...task.assignees.map((assignee) => assignee.userId), ...task.watchers.map((watcher) => watcher.userId)])].filter(
    (userId) => userId !== actorUserId,
  );
}

function taskRecipientUsers(task: Pick<TaskWithNotificationTargetUsers, "assignees" | "watchers">, actorUserId: string) {
  const users = [...task.assignees.map((assignee) => assignee.user), ...task.watchers.map((watcher) => watcher.user)];
  return [...new Map(users.filter((user) => user.id !== actorUserId).map((user) => [user.id, user])).values()];
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown email provider error.";
}
