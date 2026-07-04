import { describe, expect, it } from "vitest";

import { createAttachmentCommentRequestSchema } from "./comments.js";

describe("comment schemas", () => {
  it("accepts optional attachment comment version anchors", () => {
    expect(
      createAttachmentCommentRequestSchema.parse({
        body: "Review v2 copy.",
        versionId: "00000000-0000-0000-0000-000000000002",
      }),
    ).toEqual({
      body: "Review v2 copy.",
      versionId: "00000000-0000-0000-0000-000000000002",
    });
    expect(createAttachmentCommentRequestSchema.parse({ body: "General file note." })).toEqual({ body: "General file note." });
    expect(createAttachmentCommentRequestSchema.safeParse({ body: "Bad anchor.", versionId: "v2" }).success).toBe(false);
  });
});
