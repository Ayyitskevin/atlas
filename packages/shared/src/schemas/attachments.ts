import { z } from "zod";

export const MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/markdown",
  "text/plain",
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".csv",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".json",
  ".md",
  ".pdf",
  ".png",
  ".pptx",
  ".txt",
  ".webp",
  ".xlsx",
] as const;

export const ATTACHMENT_ACCEPT_ATTRIBUTE = [...ALLOWED_ATTACHMENT_MIME_TYPES, ...ALLOWED_ATTACHMENT_EXTENSIONS].join(",");
export const ATTACHMENT_UPLOAD_HELP_TEXT = "PDF, images, text, CSV, Markdown, JSON, Word, Excel, or PowerPoint files up to 100 MB.";

export type AllowedAttachmentExtension = (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number];
export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

const attachmentMimeTypeByExtension: Record<AllowedAttachmentExtension, AllowedAttachmentMimeType> = {
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function attachmentMimeTypeForFileName(fileName: string) {
  const extension = attachmentFileExtension(fileName);
  if (!extension || !isAllowedAttachmentExtension(extension)) return null;
  return attachmentMimeTypeByExtension[extension];
}

export function isAllowedAttachmentFileName(fileName: string) {
  const extension = attachmentFileExtension(fileName);
  return Boolean(extension && isAllowedAttachmentExtension(extension));
}

export function isAllowedAttachmentMimeType(mimeType: string) {
  return ALLOWED_ATTACHMENT_MIME_TYPES.includes(mimeType.trim().toLowerCase() as AllowedAttachmentMimeType);
}

function attachmentFileExtension(fileName: string) {
  const normalizedFileName = fileName.trim().toLowerCase();
  const dotIndex = normalizedFileName.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === normalizedFileName.length - 1) return null;
  return normalizedFileName.slice(dotIndex);
}

function isAllowedAttachmentExtension(extension: string): extension is AllowedAttachmentExtension {
  return ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension as AllowedAttachmentExtension);
}

export const createAttachmentRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(500).refine(isAllowedAttachmentFileName, "Unsupported attachment file extension."),
  mimeType: z.string().trim().toLowerCase().min(1).max(255).refine(isAllowedAttachmentMimeType, "Unsupported attachment file type."),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_SIZE_BYTES),
});

export const attachmentStorageInstructionsSchema = z.object({
  expiresInSeconds: z.number().int().positive(),
  headers: z.record(z.string()),
  method: z.enum(["GET", "PUT"]),
  objectKey: z.string().min(1),
  url: z.string().url(),
});

export const attachmentResponseSchema = z.object({
  createdAt: z.string().datetime(),
  fileName: z.string(),
  id: z.string().uuid(),
  mimeType: z.string(),
  objectKey: z.string(),
  sizeBytes: z.number().int(),
  taskId: z.string().uuid(),
  uploadedById: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export const createAttachmentResponseSchema = z.object({
  attachment: attachmentResponseSchema,
  upload: attachmentStorageInstructionsSchema,
});

export const attachmentDownloadResponseSchema = z.object({
  attachment: attachmentResponseSchema,
  download: attachmentStorageInstructionsSchema,
});

export type CreateAttachmentRequest = z.infer<typeof createAttachmentRequestSchema>;
export type AttachmentStorageInstructions = z.infer<typeof attachmentStorageInstructionsSchema>;
