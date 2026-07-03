export const WORKER_QUEUE_NAMES = {
  emailDelivery: "atlas-email-stub",
  notificationFanout: "atlas-notification-fanout",
  searchIndex: "atlas-search-index",
} as const;

export type WorkerQueueName = (typeof WORKER_QUEUE_NAMES)[keyof typeof WORKER_QUEUE_NAMES];
