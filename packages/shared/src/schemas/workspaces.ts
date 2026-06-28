import { z } from "zod";

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
});

export const updateWorkspaceRequestSchema = createWorkspaceRequestSchema.partial();

export const inviteWorkspaceMemberRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
});

export const acceptWorkspaceInvitationRequestSchema = z.object({
  token: z.string().min(32).max(512),
});

export const updateWorkspaceMemberRequestSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]),
});

export const transferWorkspaceOwnerRequestSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type UpdateWorkspaceRequest = z.infer<typeof updateWorkspaceRequestSchema>;
export type InviteWorkspaceMemberRequest = z.infer<typeof inviteWorkspaceMemberRequestSchema>;
export type AcceptWorkspaceInvitationRequest = z.infer<typeof acceptWorkspaceInvitationRequestSchema>;
export type UpdateWorkspaceMemberRequest = z.infer<typeof updateWorkspaceMemberRequestSchema>;
export type TransferWorkspaceOwnerRequest = z.infer<typeof transferWorkspaceOwnerRequestSchema>;
