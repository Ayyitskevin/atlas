import { describe, expect, it } from "vitest";

import { taskDependencySummarySchema } from "./task-dependencies.js";

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
});
