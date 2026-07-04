import type { AttachmentScanStatus } from "@atlas/db";

import { env } from "../config/env.js";
import type { AttachmentObjectMetadata } from "./object-storage.js";

export type AttachmentScanVerdict = Exclude<AttachmentScanStatus, "PENDING">;

export type AttachmentScanInput = {
  fileName: string;
  metadata: AttachmentObjectMetadata;
  mimeType: string;
  objectKey: string;
  sizeBytes: number;
  workspaceId: string;
};

export type AttachmentScanResult = {
  checkedAt: Date;
  message: string | null;
  provider: string;
  status: AttachmentScanVerdict;
};

export type AttachmentScanner = {
  scan(input: AttachmentScanInput): Promise<AttachmentScanResult>;
};

export const noopAttachmentScanner: AttachmentScanner = {
  async scan() {
    return {
      checkedAt: new Date(),
      message: "No attachment scanner configured.",
      provider: "noop",
      status: "SKIPPED",
    };
  },
};

export const attachmentScanner: AttachmentScanner = attachmentScannerFromEnv();

export function attachmentScannerFromEnv(): AttachmentScanner {
  switch (env.ATTACHMENT_SCAN_PROVIDER) {
    case "noop":
      return noopAttachmentScanner;
  }
}

export function attachmentScanBlockReason(result: AttachmentScanResult): "infected" | "scanner_error" | null {
  if (result.status === "INFECTED") return "infected";
  if (result.status === "ERROR") return "scanner_error";
  return null;
}

export function attachmentScannerErrorResult(error: unknown): AttachmentScanResult {
  return {
    checkedAt: new Date(),
    message: error instanceof Error ? error.message : String(error),
    provider: "attachment-scanner",
    status: "ERROR",
  };
}
