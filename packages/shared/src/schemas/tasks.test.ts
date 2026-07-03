import { describe, expect, it } from "vitest";

import { createTaskRequestSchema, updateTaskRequestSchema } from "./tasks.js";

describe("task schemas", () => {
  it("validates recurring task creation fields", () => {
    expect(
      createTaskRequestSchema.parse({
        recurrenceFrequency: "WEEKLY",
        recurrenceInterval: 2,
        sectionId: "00000000-0000-4000-8000-000000000001",
        title: "Weekly review",
      }),
    ).toMatchObject({
      priority: "MEDIUM",
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 2,
      title: "Weekly review",
    });
    expect(
      createTaskRequestSchema.safeParse({
        recurrenceFrequency: "DAILY",
        recurrenceInterval: 0,
        sectionId: "00000000-0000-4000-8000-000000000001",
        title: "Daily check",
      }).success,
    ).toBe(false);
  });

  it("validates recurring task updates and clears", () => {
    expect(updateTaskRequestSchema.parse({ recurrenceFrequency: null, recurrenceInterval: null, version: 3 })).toEqual({
      recurrenceFrequency: null,
      recurrenceInterval: null,
      version: 3,
    });
    expect(updateTaskRequestSchema.parse({ recurrencePaused: true, version: 4 })).toEqual({
      recurrencePaused: true,
      version: 4,
    });
    expect(updateTaskRequestSchema.safeParse({ recurrenceFrequency: "MONTHLY", recurrenceInterval: 400, version: 3 }).success).toBe(false);
  });
});
