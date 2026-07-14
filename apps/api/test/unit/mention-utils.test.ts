import { describe, expect, it } from "vitest";

import { extractMentionTokens, resolveMentionedUserIds } from "../../src/modules/comments/mention-utils.js";

describe("mention utils", () => {
  it("extracts email and name mention tokens", () => {
    expect(extractMentionTokens("Hey @ada@example.com and @Bob check this")).toEqual(["ada@example.com", "bob"]);
  });

  it("resolves mentions against workspace members and skips the actor", () => {
    const members = [
      { email: "ada@example.com", id: "user-ada", name: "Ada Lovelace" },
      { email: "bob@example.com", id: "user-bob", name: "Bob" },
    ];
    expect(resolveMentionedUserIds(["ada@example.com", "bob"], members, "user-ada")).toEqual(["user-bob"]);
  });
});
