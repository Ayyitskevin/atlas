import { describe, expect, it } from "vitest";

import { searchQuerySchema } from "./search.js";

describe("search schemas", () => {
  it("normalizes supported search query parameters", () => {
    expect(searchQuerySchema.parse({ limit: "8", q: "  roadmap  ", type: "task" })).toEqual({
      limit: 8,
      q: "roadmap",
      type: "task",
    });
  });

  it("rejects unsupported search result types", () => {
    expect(searchQuerySchema.safeParse({ q: "roadmap", type: "comment" }).success).toBe(false);
  });
});
