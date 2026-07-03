import { describe, expect, it } from "vitest";

import { createTaskLabelRequestSchema, taskLabelColorSchema } from "./labels.js";

describe("label schemas", () => {
  it("normalizes label names and validates hex colors", () => {
    expect(createTaskLabelRequestSchema.parse({ name: " Client ", color: "#22c55e" })).toEqual({
      color: "#22c55e",
      name: "Client",
    });
    expect(createTaskLabelRequestSchema.parse({ name: "Review" })).toEqual({
      color: "#64748b",
      name: "Review",
    });
    expect(taskLabelColorSchema.safeParse("blue").success).toBe(false);
  });
});
