import { z } from "zod";

import { workspaceRoleSchema } from "../domain.js";

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
});

export const updateWorkspaceRequestSchema = createWorkspaceRequestSchema.partial();

export const inviteWorkspaceMemberRequestSchema = z.object({
  email: z.string().email(),
  role: workspaceRoleSchema.default("MEMBER"),
});

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;
export type InviteWorkspaceMemberRequest = z.infer<typeof inviteWorkspaceMemberRequestSchema>;
