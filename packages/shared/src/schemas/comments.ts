import { z } from "zod";

export const createCommentRequestSchema = z.object({
  body: z.string().min(1).max(20000),
});

export const updateCommentRequestSchema = createCommentRequestSchema;
export const createAttachmentCommentRequestSchema = createCommentRequestSchema;
export const updateAttachmentCommentRequestSchema = updateCommentRequestSchema;

export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>;
export type CreateAttachmentCommentRequest = z.infer<typeof createAttachmentCommentRequestSchema>;
export type UpdateAttachmentCommentRequest = z.infer<typeof updateAttachmentCommentRequestSchema>;
