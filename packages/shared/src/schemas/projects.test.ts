import { describe, expect, it } from "vitest";

import { createProjectFromTemplateRequestSchema, createProjectTemplateFromProjectRequestSchema, updateProjectTemplateRequestSchema } from "./projects.js";

describe("project schemas", () => {
  it("validates project template snapshot requests", () => {
    expect(createProjectTemplateFromProjectRequestSchema.parse({ description: " Reuse this ", name: " Launch " })).toEqual({
      description: "Reuse this",
      name: "Launch",
    });
    expect(createProjectTemplateFromProjectRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("validates creating projects from templates", () => {
    expect(createProjectFromTemplateRequestSchema.parse({ dueDateAnchor: "2026-08-01", name: " Client launch " })).toEqual({
      dueDateAnchor: "2026-08-01",
      name: "Client launch",
      visibility: "WORKSPACE",
    });
    expect(createProjectFromTemplateRequestSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createProjectFromTemplateRequestSchema.safeParse({ dueDateAnchor: "2026-8-1", name: "Client launch" }).success).toBe(false);
  });

  it("validates project template updates", () => {
    expect(updateProjectTemplateRequestSchema.parse({ description: " Updated ", name: " Runbook " })).toEqual({
      description: "Updated",
      name: "Runbook",
    });
    expect(updateProjectTemplateRequestSchema.parse({ description: null })).toEqual({ description: null });
    expect(updateProjectTemplateRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
