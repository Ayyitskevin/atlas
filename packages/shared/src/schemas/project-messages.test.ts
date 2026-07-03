import { describe, expect, it } from "vitest";

import { createProjectMessageRequestSchema, projectMessageResponseSchema } from "./project-messages.js";

describe("project message schemas", () => {
  it("trims message fields and rejects empty posts", () => {
    expect(createProjectMessageRequestSchema.parse({ body: " Update body ", title: " Weekly update " })).toEqual({
      body: "Update body",
      title: "Weekly update",
    });
    expect(createProjectMessageRequestSchema.safeParse({ body: "", title: "Weekly update" }).success).toBe(false);
    expect(createProjectMessageRequestSchema.safeParse({ body: "Update body", title: "" }).success).toBe(false);
  });

  it("accepts nullable pin metadata on message responses", () => {
    const base = {
      author: { email: "user@example.com", id: "0f9b0c89-fbf4-4f44-a393-6f2eb7eaf4e6", name: "User" },
      authorId: "0f9b0c89-fbf4-4f44-a393-6f2eb7eaf4e6",
      body: "Update body",
      createdAt: "2026-07-03T00:00:00.000Z",
      id: "297f2a04-a175-411e-83f3-6b07e01ce577",
      projectId: "d94acbbf-1c69-492c-84f8-c6e92ce55ef3",
      title: "Weekly update",
      updatedAt: "2026-07-03T00:00:00.000Z",
      workspaceId: "b1c2e0d5-3a67-43b0-8bf3-2102d698b5a7",
    };

    expect(projectMessageResponseSchema.parse({ ...base, pinnedAt: null, pinnedById: null })).toMatchObject({
      pinnedAt: null,
      pinnedById: null,
    });
    expect(
      projectMessageResponseSchema.parse({
        ...base,
        pinnedAt: "2026-07-03T01:00:00.000Z",
        pinnedById: "0f9b0c89-fbf4-4f44-a393-6f2eb7eaf4e6",
      }),
    ).toMatchObject({
      pinnedAt: "2026-07-03T01:00:00.000Z",
      pinnedById: "0f9b0c89-fbf4-4f44-a393-6f2eb7eaf4e6",
    });
  });
});
