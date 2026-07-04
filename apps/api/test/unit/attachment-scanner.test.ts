import { describe, expect, it } from "vitest";

import {
  attachmentScanBlockReason,
  attachmentScannerErrorResult,
  noopAttachmentScanner,
} from "../../src/storage/attachment-scanner.js";

describe("attachment scanner", () => {
  it("uses an explicit skipped verdict for the noop scanner", async () => {
    await expect(
      noopAttachmentScanner.scan({
        fileName: "brief.pdf",
        metadata: { contentLength: 2048, contentType: "application/pdf", eTag: null, lastModified: null },
        mimeType: "application/pdf",
        objectKey: "workspaces/workspace/tasks/task/brief.pdf",
        sizeBytes: 2048,
        workspaceId: "workspace",
      }),
    ).resolves.toMatchObject({
      message: "No attachment scanner configured.",
      provider: "noop",
      status: "SKIPPED",
    });
  });

  it("blocks infected and scanner-error verdicts", () => {
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "INFECTED" })).toBe("infected");
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "ERROR" })).toBe("scanner_error");
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "scanner", status: "CLEAN" })).toBeNull();
    expect(attachmentScanBlockReason({ checkedAt: new Date(), message: null, provider: "noop", status: "SKIPPED" })).toBeNull();
  });

  it("normalizes thrown scanner failures into error verdicts", () => {
    expect(attachmentScannerErrorResult(new Error("scanner unavailable"))).toMatchObject({
      message: "scanner unavailable",
      provider: "attachment-scanner",
      status: "ERROR",
    });
  });
});
