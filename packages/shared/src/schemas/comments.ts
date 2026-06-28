import { z } from "zod";

export const createCommentRequestSchema = z.object({
  body: z.string().min(1).max(20000),
});

export const updateCommentRequestSchema = createCommentRequestSchema;

export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>;
