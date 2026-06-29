import type { PrismaClient, ProjectRole, ProjectVisibility, WorkspaceRole } from "@atlas/db";
import { ATLAS_ERROR_CODES } from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";

const workspaceRank: Record<WorkspaceRole, number> = {
  GUEST: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

const projectRank: Record<ProjectRole, number> = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  PROJECT_ADMIN: 3,
};

export class PermissionsService {
  constructor(private readonly prisma: PrismaClient) {}

  async requireWorkspaceRole(ctx: AuthContext, workspaceId: string, minimum: WorkspaceRole): Promise<WorkspaceRole> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        deletedAt: null,
        userId: ctx.userId,
        workspace: { deletedAt: null, id: workspaceId },
      },
    });

    if (!member || workspaceRank[member.role] < workspaceRank[minimum]) {
      throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "You do not have permission in this Workspace.");
    }

    return member.role;
  }

  async requireProjectRole(ctx: AuthContext, workspaceId: string, projectId: string, minimum: ProjectRole): Promise<void> {
    const workspaceRole = await this.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const project = await this.prisma.project.findFirst({
      where: { deletedAt: null, id: projectId, workspaceId },
      select: { id: true, visibility: true },
    });
    if (!project) {
      throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project not found.");
    }

    if (workspaceRole === "OWNER" || workspaceRole === "ADMIN") return;

    const effectiveRole = await this.projectRoleForUser(ctx.userId, workspaceRole, project.id, project.visibility);
    if (!effectiveRole || projectRank[effectiveRole] < projectRank[minimum]) {
      throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "You do not have permission in this Project.");
    }
  }

  async requireTaskRole(ctx: AuthContext, workspaceId: string, taskId: string, minimum: ProjectRole): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { deletedAt: null, id: taskId, workspaceId },
      select: { projectId: true },
    });
    if (!task) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Task not found.");
    await this.requireProjectRole(ctx, workspaceId, task.projectId, minimum);
  }

  private async projectRoleForUser(
    userId: string,
    workspaceRole: WorkspaceRole,
    projectId: string,
    visibility: ProjectVisibility,
  ): Promise<ProjectRole | null> {
    const explicit = await this.prisma.projectMember.findFirst({
      where: { deletedAt: null, projectId, userId },
      select: { role: true },
    });
    if (explicit) return explicit.role;
    if (visibility === "PRIVATE") return null;
    return workspaceRole === "GUEST" ? "VIEWER" : "EDITOR";
  }
}
