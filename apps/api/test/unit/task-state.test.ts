import { describe, expect, it } from "vitest";

import { completedAtForStatusTransition, isAlreadyCompleted } from "../../src/modules/work/task-state.js";

describe("task state transitions", () => {
  it("sets completedAt when a task transitions to done", () => {
    const now = new Date("2026-06-28T12:00:00.000Z");

    expect(completedAtForStatusTransition("DONE", now)).toEqual(now);
  });

  it("clears completedAt when a task reopens", () => {
    expect(completedAtForStatusTransition("IN_PROGRESS", new Date())).toBeNull();
  });

  it("leaves completedAt unchanged when status is not part of the update", () => {
    expect(completedAtForStatusTransition(undefined, new Date())).toBeUndefined();
  });

  it("detects already-completed tasks", () => {
    expect(isAlreadyCompleted("DONE")).toBe(true);
    expect(isAlreadyCompleted("TODO")).toBe(false);
  });
});
