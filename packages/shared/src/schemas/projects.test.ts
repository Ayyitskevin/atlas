import { describe, expect, it } from "vitest";

import { createProjectFromTemplateRequestSchema, createProjectTemplateFromProjectRequestSchema } from "./projects.js";

describe("project schemas", () => {
  it("validates project template snapshot requests", () => {
    expect(createProjectTemplateFromProjectRequestSchema.parse({ description: " Reuse this ", name: " Launch " })).toEqual({
      description: "Reuse this",
      name: "Launch",
    });
    expect(createProjectTemplateFromProjectRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates creating projects from templates", () => {
    expect(createProjectFromTemplateRequestSchema.parse({ name: " Client launch " })).toEqual({
      name: "Client launch",
      visibility: "WORKSPACE",
    });
    expect(createProjectFromTemplateRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
