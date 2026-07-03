import { describe, expect, it } from "vitest";

import { taskDependencyEdgeSchema, taskDependencySummarySchema } from "./task-dependencies.js";

describe("task dependency schemas", () => {
  it("validates compact dependency summaries", () => {
    expect(
      taskDependencySummarySchema.parse({
        blockedByOpenCount: 2,
        blocksCount: 1,
        isBlocked: true,
      }),
    ).toEqual({
      blockedByOpenCount: 2,
      blocksCount: 1,
      isBlocked: true,
    });

    expect(
      taskDependencySummarySchema.safeParse({
        blockedByOpenCount: -1,
        blocksCount: 0,
        isBlocked: false,
      }).success,
    ).toBe(false);
  });

  it("validates enriched task context on dependency edges", () => {
    expect(
      taskDependencyEdgeSchema.parse({
        blockedTaskId: "33333333-3333-4333-8333-333333333333",
        blockingTaskId: "22222222-2222-4222-8222-222222222222",
        createdAt: "2026-07-03T12:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
        task: {
          assigneeCount: 1,
          dependencySummary: {
            blockedByOpenCount: 1,
            blocksCount: 0,
            isBlocked: true,
          },
          dueDate: "2026-07-20",
          id: "33333333-3333-4333-8333-333333333333",
          priority: "HIGH",
          status: "TODO",
          title: "Client approval",
        },
      }),
    ).toMatchObject({
      task: {
        assigneeCount: 1,
        dueDate: "2026-07-20",
        priority: "HIGH",
      },
    });

    expect(
      taskDependencyEdgeSchema.safeParse({
        blockedTaskId: "33333333-3333-4333-8333-333333333333",
        blockingTaskId: "22222222-2222-4222-8222-222222222222",
        createdAt: "2026-07-03T12:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
        task: {
          assigneeCount: -1,
          id: "33333333-3333-4333-8333-333333333333",
          status: "TODO",
          title: "Client approval",
        },
      }).success,
    ).toBe(false);
  });
});
