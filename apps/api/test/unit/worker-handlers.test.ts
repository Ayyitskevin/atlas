import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createNoopEmailProvider, type EmailProvider } from "../../src/email/email-provider.js";
import {
  handleEmailDeliveryJob,
  handleNotificationFanoutJob,
  handleSearchIndexJob,
  type EmailDeliveryStore,
  type NotificationFanoutStore,
  type WorkerJobLike,
} from "../../src/jobs/worker-handlers.js";
import type { MutationEventJob } from "../../src/jobs/queues.js";

describe("worker handlers", () => {
  it("records search indexing as an explicit stub outcome", async () => {
    const job = jobFor(eventJob({ eventType: "TaskUpdated" }));

    await expect(handleSearchIndexJob(job)).resolves.toMatchObject({
      provider: "database-search",
      queue: "atlas-search-index",
      status: "stubbed",
    });
    expectLoggedOutcome(job, { provider: "database-search", status: "stubbed" });
  });

  it("records email delivery as an explicit no-op provider outcome", async () => {
    const actorUserId = randomUUID();
    const store = emailStore({
      task: {
        assignees: [
          { user: { email: "actor@example.com", id: actorUserId, name: "Actor" } },
          { user: { email: "teammate@example.com", id: randomUUID(), name: "Teammate" } },
        ],
        id: randomUUID(),
        title: "Launch checklist",
      },
    });
    const job = jobFor(eventJob({ actorUserId, eventType: "CommentCreated" }));

    await expect(handleEmailDeliveryJob(job, store, createNoopEmailProvider())).resolves.toMatchObject({
      provider: "noop",
      queue: "atlas-email-stub",
      recipientCount: 1,
      status: "stubbed",
    });
    expectLoggedOutcome(job, { provider: "noop", recipientCount: 1, status: "stubbed" });
  });

  it("sends task notification emails through the provider seam", async () => {
    const actorUserId = randomUUID();
    const recipientId = randomUUID();
    const taskId = randomUUID();
    const send = vi.fn<EmailProvider["send"]>().mockResolvedValue({
      acceptedRecipientCount: 1,
      provider: "test-email",
      providerMessageId: "message-1",
      stubbed: false,
    });
    const provider = testEmailProvider(send);
    const store = emailStore({
      task: {
        assignees: [
          { user: { email: "actor@example.com", id: actorUserId, name: "Actor" } },
          { user: { email: "teammate@example.com", id: recipientId, name: "Teammate" } },
        ],
        id: taskId,
        title: "Launch checklist",
      },
    });
    const job = jobFor(eventJob({ actorUserId, eventType: "TaskUpdated", taskId }));

    await expect(handleEmailDeliveryJob(job, store, provider)).resolves.toMatchObject({
      provider: "test-email",
      providerMessageId: "message-1",
      queue: "atlas-email-stub",
      recipientCount: 1,
      status: "delivered",
    });
    expect(send).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        eventId: job.data.eventId,
        eventType: "TaskUpdated",
        taskId,
        workspaceId: job.data.workspaceId,
      }),
      subject: "Atlas: Task updated",
      text: '"Launch checklist" was updated.\n\nOpen Atlas to review the task.',
      to: [{ email: "teammate@example.com", name: "Teammate" }],
    });
    expectLoggedOutcome(job, { provider: "test-email", providerMessageId: "message-1", status: "delivered" });
  });

  it("logs and rethrows email provider failures for BullMQ retries", async () => {
    const providerError = new Error("SMTP service unavailable");
    const send = vi.fn<EmailProvider["send"]>().mockRejectedValue(providerError);
    const provider = testEmailProvider(send);
    const store = emailStore({
      task: {
        assignees: [{ user: { email: "teammate@example.com", id: randomUUID(), name: "Teammate" } }],
        id: randomUUID(),
        title: "Launch checklist",
      },
    });
    const job = jobFor(eventJob({ eventType: "CommentCreated" }));

    await expect(handleEmailDeliveryJob(job, store, provider)).rejects.toThrow("SMTP service unavailable");
    expectLoggedOutcome(job, {
      provider: "test-email",
      reason: "SMTP service unavailable",
      recipientCount: 1,
      status: "failed",
    });
  });

  it("skips notification fanout when there is no task scope", async () => {
    const store = notificationStore();
    const job = jobFor(eventJob({ taskId: null }));

    await expect(handleNotificationFanoutJob(job, store)).resolves.toMatchObject({
      queue: "atlas-notification-fanout",
      reason: "Event has no task scope.",
      status: "skipped",
    });
    expect(store.task.findFirst).not.toHaveBeenCalled();
    expect(store.notification.createMany).not.toHaveBeenCalled();
    expectLoggedOutcome(job, { status: "skipped" });
  });

  it("creates notifications for task assignees except the actor", async () => {
    const actorUserId = randomUUID();
    const recipientId = randomUUID();
    const taskId = randomUUID();
    const store = notificationStore({
      task: {
        assignees: [{ userId: actorUserId }, { userId: recipientId }],
        id: taskId,
        title: "Launch checklist",
      },
    });
    const job = jobFor(eventJob({ actorUserId, eventType: "TaskUpdated", taskId }));

    await expect(handleNotificationFanoutJob(job, store)).resolves.toMatchObject({
      queue: "atlas-notification-fanout",
      recipientCount: 1,
      status: "delivered",
    });
    expect(store.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          body: '"Launch checklist" was updated.',
          recipientId,
          taskId,
          title: "Task updated",
          type: "task.TaskUpdated",
        }),
      ],
      skipDuplicates: true,
    });
    expectLoggedOutcome(job, { recipientCount: 1, status: "delivered" });
  });

  it("skips notification fanout when no eligible assignees remain", async () => {
    const actorUserId = randomUUID();
    const store = notificationStore({
      task: {
        assignees: [{ userId: actorUserId }],
        id: randomUUID(),
        title: "Solo task",
      },
    });
    const job = jobFor(eventJob({ actorUserId }));

    await expect(handleNotificationFanoutJob(job, store)).resolves.toMatchObject({
      reason: "No eligible task assignees.",
      recipientCount: 0,
      status: "skipped",
    });
    expect(store.notification.createMany).not.toHaveBeenCalled();
    expectLoggedOutcome(job, { recipientCount: 0, status: "skipped" });
  });
});

function eventJob(input: Partial<MutationEventJob> = {}): MutationEventJob {
  return {
    actorUserId: randomUUID(),
    entityId: randomUUID(),
    entityType: "task",
    eventId: randomUUID(),
    eventType: "TaskUpdated",
    projectId: randomUUID(),
    taskId: randomUUID(),
    workspaceId: randomUUID(),
    ...input,
  };
}

function expectLoggedOutcome(job: WorkerJobLike, expected: Record<string, unknown>) {
  const log = vi.mocked(job.log);
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject(expected);
}

function jobFor(data: MutationEventJob): WorkerJobLike {
  return {
    data,
    log: vi.fn(),
  };
}

function notificationStore(input: { task?: Awaited<ReturnType<NotificationFanoutStore["task"]["findFirst"]>> } = {}) {
  return {
    notification: {
      createMany: vi.fn().mockImplementation((payload: { data: unknown[] }) => Promise.resolve({ count: payload.data.length })),
    },
    task: {
      findFirst: vi.fn().mockResolvedValue(input.task ?? null),
    },
  } satisfies NotificationFanoutStore;
}

function emailStore(input: { task?: Awaited<ReturnType<EmailDeliveryStore["task"]["findFirst"]>> } = {}) {
  return {
    task: {
      findFirst: vi.fn().mockResolvedValue(input.task ?? null),
    },
  } satisfies EmailDeliveryStore;
}

function testEmailProvider(send: EmailProvider["send"]): EmailProvider {
  return {
    from: "Atlas <no-reply@example.com>",
    name: "test-email",
    send,
  };
}
