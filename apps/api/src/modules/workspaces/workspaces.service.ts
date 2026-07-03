import type { WorkspaceRole } from "@atlas/db";
import {
  ATLAS_ERROR_CODES,
  type AcceptWorkspaceInvitationRequest,
  type CreateWorkspaceRequest,
  type CursorPaginationQuery,
  type InviteWorkspaceMemberRequest,
  type TransferWorkspaceOwnerRequest,
  type UpdateWorkspaceMemberRequest,
  type UpdateWorkspaceRequest,
} from "@atlas/shared";

import type { EmailDeliveryOutcome, EmailProvider } from "../../email/email-provider.js";
import { sendWorkspaceInvitationEmail } from "../../email/workspace-invitation-email.js";
import type { AuthContext } from "../../shared/auth-context.js";
import { createOpaqueToken, hashToken } from "../../shared/crypto.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkspacesRepository } from "./workspaces.repository.js";

const invitationTtlMs = 1000 * 60 * 60 * 24 * 7;

export class WorkspacesService {
  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly permissions: PermissionsService,
    private readonly emailProvider: EmailProvider,
    private readonly webOrigin: string,
  ) {}

  async create(ctx: AuthContext, input: CreateWorkspaceRequest) {
    return this.workspacesRepository.create({ ...input, ownerId: ctx.userId });
  }

  async list(ctx: AuthContext, query: CursorPaginationQuery) {
    const items = await this.workspacesRepository.listForUser({ ...query, userId: ctx.userId });
    return pageFromLimit(items, query.limit);
  }

  async get(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const workspace = await this.workspacesRepository.findById(workspaceId);
    if (!workspace) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Workspace not found.");
    return workspace;
  }

  async update(ctx: AuthContext, workspaceId: string, input: UpdateWorkspaceRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    return this.workspacesRepository.update(workspaceId, input);
  }

  async delete(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "OWNER");
    return this.workspacesRepository.softDelete(workspaceId);
  }

  async inviteMember(ctx: AuthContext, workspaceId: string, input: InviteWorkspaceMemberRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const email = input.email.toLowerCase();
    const user = await this.workspacesRepository.findUserByEmail(email);
    if (user) {
      const member = await this.workspacesRepository.findActiveMember({ userId: user.id, workspaceId });
      if (member) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "User is already a Workspace member.");
    }

    const existingInvitation = await this.workspacesRepository.findActiveInvitationByEmail({ email, workspaceId });
    if (existingInvitation) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "An active invitation already exists for this email.");
    }

    const acceptToken = createOpaqueToken();
    const invitation = await this.workspacesRepository.createInvitation({
      email,
      expiresAt: new Date(Date.now() + invitationTtlMs),
      invitedById: ctx.userId,
      role: input.role as WorkspaceRole,
      tokenHash: hashToken(acceptToken),
      workspaceId,
    });
    const emailDelivery = await this.deliverInvitationEmail({
      acceptToken,
      email,
      expiresAt: invitation.expiresAt,
      invitationId: invitation.id,
      invitedById: ctx.userId,
      role: invitation.role as Exclude<WorkspaceRole, "OWNER">,
      workspaceId,
    });

    return { ...invitation, acceptToken, emailDelivery, status: "PENDING" };
  }

  async acceptInvitation(ctx: AuthContext, input: AcceptWorkspaceInvitationRequest) {
    const invitation = await this.workspacesRepository.findInvitationByTokenHash(hashToken(input.token));
    if (!invitation || invitation.acceptedAt || invitation.canceledAt || invitation.declinedAt || invitation.expiresAt < new Date()) {
      throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Invitation not found.");
    }

    const user = await this.workspacesRepository.findUserById(ctx.userId);
    if (!user) throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "User no longer exists.");
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "Invitation email does not match the authenticated user.");
    }

    const member = await this.workspacesRepository.acceptInvitation({
      acceptedById: ctx.userId,
      invitationId: invitation.id,
      invitedById: invitation.invitedById,
      role: invitation.role as WorkspaceRole,
      workspaceId: invitation.workspaceId,
    });
    if (!member) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "Invitation can no longer be accepted.");
    return { member };
  }

  async listInvitations(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    return { items: await this.workspacesRepository.listInvitations(workspaceId) };
  }

  async cancelInvitation(ctx: AuthContext, workspaceId: string, invitationId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const result = await this.workspacesRepository.cancelInvitation({ invitationId, workspaceId });
    if (result.count === 0) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Invitation not found.");
    return { ok: true };
  }

  async resendInvitation(ctx: AuthContext, workspaceId: string, invitationId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const acceptToken = createOpaqueToken();
    const invitation = await this.workspacesRepository.resendInvitation({
      expiresAt: new Date(Date.now() + invitationTtlMs),
      invitationId,
      tokenHash: hashToken(acceptToken),
      workspaceId,
    });
    if (!invitation) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Invitation not found.");
    const emailDelivery = await this.deliverInvitationEmail({
      acceptToken,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      invitationId: invitation.id,
      invitedById: invitation.invitedById,
      role: invitation.role as Exclude<WorkspaceRole, "OWNER">,
      workspaceId,
    });
    return { acceptToken, emailDelivery, ok: true };
  }

  async listMembers(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return { items: await this.workspacesRepository.listMembers(workspaceId) };
  }

  async updateMember(ctx: AuthContext, workspaceId: string, userId: string, input: UpdateWorkspaceMemberRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    const member = await this.workspacesRepository.findActiveMember({ userId, workspaceId });
    if (!member) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Workspace member not found.");
    if (member.role === "OWNER") throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "Use owner transfer to change the Workspace owner.");

    const result = await this.workspacesRepository.updateMemberRole({ role: input.role as WorkspaceRole, userId, workspaceId });
    if (result.count === 0) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Workspace member not found.");
    return { ok: true };
  }

  async removeMember(ctx: AuthContext, workspaceId: string, userId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "ADMIN");
    if (ctx.userId === userId) throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "Admins cannot remove their own Workspace membership.");
    const member = await this.workspacesRepository.findActiveMember({ userId, workspaceId });
    if (!member) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Workspace member not found.");
    if (member.role === "OWNER") throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "Transfer ownership before removing the owner.");

    const result = await this.workspacesRepository.removeMember({ userId, workspaceId });
    if (result.count === 0) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Workspace member not found.");
    return { ok: true };
  }

  async transferOwner(ctx: AuthContext, workspaceId: string, input: TransferWorkspaceOwnerRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "OWNER");
    if (ctx.userId === input.userId) throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Target user is already the Workspace owner.");
    const member = await this.workspacesRepository.transferOwnership({
      newOwnerId: input.userId,
      previousOwnerId: ctx.userId,
      workspaceId,
    });
    if (!member) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Target Workspace member not found.");
    return { ok: true };
  }

  private async deliverInvitationEmail(input: {
    acceptToken: string;
    email: string;
    expiresAt: Date;
    invitationId: string;
    invitedById: string;
    role: Exclude<WorkspaceRole, "OWNER">;
    workspaceId: string;
  }): Promise<EmailDeliveryOutcome> {
    const context = await this.workspacesRepository.findInvitationEmailContext({
      invitedById: input.invitedById,
      workspaceId: input.workspaceId,
    });
    if (!context) {
      return {
        provider: this.emailProvider.name,
        reason: "Workspace no longer exists.",
        recipientCount: 0,
        status: "failed",
      };
    }

    const invitedByName = context.members[0]?.user.name ?? context.owner.name;
    return sendWorkspaceInvitationEmail(this.emailProvider, {
      acceptToken: input.acceptToken,
      email: input.email,
      expiresAt: input.expiresAt,
      invitationId: input.invitationId,
      invitedByName,
      role: input.role,
      webOrigin: this.webOrigin,
      workspaceId: input.workspaceId,
      workspaceName: context.name,
    });
  }
}
