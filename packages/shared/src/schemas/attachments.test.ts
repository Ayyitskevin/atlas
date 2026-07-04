import { describe, expect, it } from "vitest";

import {
  MAX_ATTACHMENT_SIZE_BYTES,
  attachmentMimeTypeForFileName,
  createAttachmentRequestSchema,
  isAllowedAttachmentFileName,
  isAllowedAttachmentMimeType,
  replaceAttachmentRequestSchema,
  updateAttachmentRequestSchema,
} from "./attachments.js";

describe("attachment schemas", () => {
  it("accepts supported attachment metadata", () => {
    expect(
      createAttachmentRequestSchema.parse({
        fileName: " brief.pdf ",
        description: " Needs client approval. ",
        mimeType: " application/pdf ",
        sizeBytes: 2048,
      }),
    ).toEqual({
      description: "Needs client approval.",
      fileName: "brief.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
    });
  });

  it("rejects unsupported attachment metadata", () => {
    expect(createAttachmentRequestSchema.safeParse({ fileName: "script.html", mimeType: "text/html", sizeBytes: 2048 }).success).toBe(false);
    expect(createAttachmentRequestSchema.safeParse({ fileName: "run.exe", mimeType: "application/pdf", sizeBytes: 2048 }).success).toBe(false);
    expect(
      createAttachmentRequestSchema.safeParse({
        fileName: "brief.pdf",
        mimeType: "application/pdf",
        sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("derives upload MIME types from supported file extensions", () => {
    expect(attachmentMimeTypeForFileName("brief.PDF")).toBe("application/pdf");
    expect(attachmentMimeTypeForFileName("notes.md")).toBe("text/markdown");
    expect(attachmentMimeTypeForFileName("archive.zip")).toBeNull();
    expect(isAllowedAttachmentFileName("photo.jpeg")).toBe(true);
    expect(isAllowedAttachmentFileName("photo.tiff")).toBe(false);
    expect(isAllowedAttachmentMimeType(" IMAGE/PNG ")).toBe(true);
    expect(isAllowedAttachmentMimeType("application/octet-stream")).toBe(false);
  });

  it("accepts bounded attachment notes", () => {
    expect(updateAttachmentRequestSchema.parse({ description: " Reviewed by Maya. " })).toEqual({ description: "Reviewed by Maya." });
    expect(updateAttachmentRequestSchema.parse({ description: "" })).toEqual({ description: "" });
    expect(updateAttachmentRequestSchema.safeParse({ description: "x".repeat(1001) }).success).toBe(false);
  });

  it("validates replacement attachment metadata without notes", () => {
    expect(replaceAttachmentRequestSchema.parse({ fileName: "brief-v2.pdf", mimeType: "application/pdf", sizeBytes: 4096 })).toEqual({
      fileName: "brief-v2.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096,
    });
    expect(replaceAttachmentRequestSchema.safeParse({ description: "Not accepted.", fileName: "brief-v2.pdf", mimeType: "application/pdf", sizeBytes: 4096 }).success).toBe(false);
  });
});
