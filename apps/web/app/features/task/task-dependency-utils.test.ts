import { describe, expect, it } from "vitest";

import type { TaskDependencies } from "../shared/atlas-types";
import { dependencyTaskIds, openDependencyBlockers, readyDependencyBlockers } from "./task-dependency-utils";

const dependencies: TaskDependencies = {
  blockedBy: [
    {
      blockedTaskId: "task-4",
      blockingTaskId: "task-1",
      createdAt: "2026-07-03T12:00:00.000Z",
      id: "dep-1",
      task: {
        dependencySummary: { blockedByOpenCount: 0, blocksCount: 1, isBlocked: false },
        id: "task-1",
        status: "TODO",
        title: "Ready blocker",
      },
    },
    {
      blockedTaskId: "task-4",
      blockingTaskId: "task-2",
      createdAt: "2026-07-03T12:01:00.000Z",
      id: "dep-2",
      task: {
        dependencySummary: { blockedByOpenCount: 1, blocksCount: 1, isBlocked: true },
        id: "task-2",
        status: "IN_PROGRESS",
        title: "Nested blocker",
      },
    },
    {
      blockedTaskId: "task-4",
      blockingTaskId: "task-3",
      createdAt: "2026-07-03T12:02:00.000Z",
      id: "dep-3",
      task: {
        dependencySummary: { blockedByOpenCount: 0, blocksCount: 1, isBlocked: false },
        id: "task-3",
        status: "DONE",
        title: "Done blocker",
      },
    },
  ],
  blocks: [],
  isBlocked: true,
};

describe("task dependency utils", () => {
  it("finds open blockers and only batches blockers that are ready to complete", () => {
    expect(dependencyTaskIds(openDependencyBlockers(dependencies))).toEqual(["task-1", "task-2"]);
    expect(dependencyTaskIds(readyDependencyBlockers(dependencies))).toEqual(["task-1"]);
  });
});
