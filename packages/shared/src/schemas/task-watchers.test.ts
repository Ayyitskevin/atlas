import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { taskWatcherUserRequestSchema } from "./task-watchers.js";

describe("task watcher schemas", () => {
  it("requires a watcher user id", () => {
    const userId = randomUUID();
    expect(taskWatcherUserRequestSchema.parse({ userId })).toEqual({ userId });
    expect(taskWatcherUserRequestSchema.safeParse({ userId: "not-a-uuid" }).success).toBe(false);
  });
});
