import { describe, expect, it } from "vitest";

import { MAX_ATTACHMENT_SIZE_BYTES } from "@atlas/shared";

import { attachmentMimeTypeForUpload, attachmentUploadValidationMessage } from "./attachment-upload-utils";

describe("attachment upload helpers", () => {
  it("accepts supported files and infers a MIME type when the browser omits one", () => {
    const file = { name: "brief.pdf", size: 2048, type: "" };

    expect(attachmentUploadValidationMessage(file)).toBe("");
    expect(attachmentMimeTypeForUpload(file)).toBe("application/pdf");
  });

  it("rejects unsupported files before upload", () => {
    expect(attachmentUploadValidationMessage({ name: "script.html", size: 2048, type: "text/html" })).toContain("Unsupported file extension.");
    expect(attachmentUploadValidationMessage({ name: "brief.pdf", size: 2048, type: "text/html" })).toContain("Unsupported file type.");
    expect(attachmentUploadValidationMessage({ name: "brief.pdf", size: 0, type: "application/pdf" })).toBe("Choose a non-empty file.");
    expect(attachmentUploadValidationMessage({ name: "brief.pdf", size: MAX_ATTACHMENT_SIZE_BYTES + 1, type: "application/pdf" })).toBe(
      "Attachments must be 100 MB or smaller.",
    );
  });
});
