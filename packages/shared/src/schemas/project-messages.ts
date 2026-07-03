import { z } from "zod";

export const createProjectMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  title: z.string().trim().min(1).max(160),
});

export const updateProjectMessageRequestSchema = createProjectMessageRequestSchema.partial();

export const projectMessageAuthorSchema = z.object({
  email: z.string().email(),
  id: z.string().uuid(),
  name: z.string(),
});

export const projectMessageResponseSchema = z.object({
  author: projectMessageAuthorSchema,
  authorId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  updatedAt: z.string().datetime(),
  workspaceId: z.string().uuid(),
});

export type CreateProjectMessageRequest = z.infer<typeof createProjectMessageRequestSchema>;
export type ProjectMessageResponse = z.infer<typeof projectMessageResponseSchema>;
export type UpdateProjectMessageRequest = z.infer<typeof updateProjectMessageRequestSchema>;
