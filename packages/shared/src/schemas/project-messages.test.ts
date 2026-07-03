import { describe, expect, it } from "vitest";

import { createProjectMessageRequestSchema } from "./project-messages.js";

describe("project message schemas", () => {
  it("trims message fields and rejects empty posts", () => {
    expect(createProjectMessageRequestSchema.parse({ body: " Update body ", title: " Weekly update " })).toEqual({
      body: "Update body",
      title: "Weekly update",
    });
    expect(createProjectMessageRequestSchema.safeParse({ body: "", title: "Weekly update" }).success).toBe(false);
    expect(createProjectMessageRequestSchema.safeParse({ body: "Update body", title: "" }).success).toBe(false);
  });
});
