import { z } from "zod";

const maxAttachmentSizeBytes = 100 * 1024 * 1024;

export const createAttachmentRequestSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(maxAttachmentSizeBytes),
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
