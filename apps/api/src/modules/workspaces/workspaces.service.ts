import type { WorkspaceRole } from "@atlas/db";
import {
  ATLAS_ERROR_CODES,
  type CreateWorkspaceRequest,
  type CursorPaginationQuery,
  type InviteWorkspaceMemberRequest,
  type UpdateWorkspaceRequest,
} from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { WorkspacesRepository } from "./workspaces.repository.js";

export class WorkspacesService {
  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly permissions: PermissionsService,
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
    const user = await this.workspacesRepository.findUserByEmail(input.email.toLowerCase());
    if (!user) {
      return { email: input.email.toLowerCase(), status: "INVITE_STUBBED" };
    }
    return this.workspacesRepository.upsertMember({
      invitedById: ctx.userId,
      role: input.role as WorkspaceRole,
      userId: user.id,
      workspaceId,
    });
  }

  async listMembers(ctx: AuthContext, workspaceId: string) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    return { items: await this.workspacesRepository.listMembers(workspaceId) };
  }
}
