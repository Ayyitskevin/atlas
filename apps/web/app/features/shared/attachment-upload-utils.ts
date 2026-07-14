import {
  ATTACHMENT_UPLOAD_HELP_TEXT,
  MAX_ATTACHMENT_SIZE_BYTES,
  attachmentMimeTypeForFileName,
  isAllowedAttachmentFileName,
  isAllowedAttachmentMimeType,
} from "@atlas/shared";

import { formatBytes } from "./atlas-format";

type AttachmentFileLike = {
  name: string;
  size: number;
  type?: string;
};

export function attachmentMimeTypeForUpload(file: AttachmentFileLike) {
  return file.type?.trim() || attachmentMimeTypeForFileName(file.name) || "";
}

export function attachmentUploadValidationMessage(file: AttachmentFileLike) {
  if (!file.name.trim()) return "Choose a file to upload.";
  if (file.size <= 0) return "Choose a non-empty file.";
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) return "Attachments must be " + formatBytes(MAX_ATTACHMENT_SIZE_BYTES) + " or smaller.";
  if (!isAllowedAttachmentFileName(file.name)) return "Unsupported file extension. " + ATTACHMENT_UPLOAD_HELP_TEXT;
  if (!isAllowedAttachmentMimeType(attachmentMimeTypeForUpload(file))) return "Unsupported file type. " + ATTACHMENT_UPLOAD_HELP_TEXT;
  return "";
}
