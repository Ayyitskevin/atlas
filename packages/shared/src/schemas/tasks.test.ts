import { describe, expect, it } from "vitest";

import { createTaskRequestSchema, myWorkQuerySchema, projectTaskQuerySchema, updateTaskRequestSchema } from "./tasks.js";

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

  it("validates my work dependency filters", () => {
    expect(myWorkQuerySchema.parse({ dependency: "blocked" })).toMatchObject({
      dependency: "blocked",
      due: "any",
      scope: "assigned",
      status: "open",
    });
    expect(myWorkQuerySchema.parse({ dependency: "blocking" })).toMatchObject({ dependency: "blocking" });
    expect(myWorkQuerySchema.safeParse({ dependency: "waiting" }).success).toBe(false);
  });

  it("validates project task dependency filters", () => {
    expect(projectTaskQuerySchema.parse({ dependency: "blocked" })).toMatchObject({
      dependency: "blocked",
      limit: 25,
    });
    expect(projectTaskQuerySchema.parse({ dependency: "blocking", limit: "100" })).toMatchObject({
      dependency: "blocking",
      limit: 100,
    });
    expect(projectTaskQuerySchema.safeParse({ dependency: "waiting" }).success).toBe(false);
  });
});
