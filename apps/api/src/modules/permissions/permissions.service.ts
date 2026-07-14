import type { PrismaClient, ProjectRole, WorkspaceRole } from "@atlas/db";
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

type CacheEntry<T> = { expiresAt: number; value: T };

const DEFAULT_TTL_MS = 15_000;

/**
 * Short-lived in-process permission cache. Membership mutations should call `invalidateUser`
 * (or wait for TTL). Safe as a performance layer only — DB remains source of truth.
 */
export class PermissionsService {
  private readonly workspaceCache = new Map<string, CacheEntry<WorkspaceRole | null>>();
  private readonly projectCache = new Map<string, CacheEntry<ProjectRole | null>>();
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaClient,
    options?: { ttlMs?: number },
  ) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  }

  invalidateUser(userId: string): void {
    for (const key of this.workspaceCache.keys()) {
      if (key.startsWith(userId + ":")) this.workspaceCache.delete(key);
    }
    for (const key of this.projectCache.keys()) {
      if (key.startsWith(userId + ":")) this.projectCache.delete(key);
    }
  }

  invalidateWorkspace(workspaceId: string): void {
    for (const key of this.workspaceCache.keys()) {
      if (key.endsWith(":" + workspaceId)) this.workspaceCache.delete(key);
    }
    for (const key of this.projectCache.keys()) {
      if (key.includes(":" + workspaceId + ":")) this.projectCache.delete(key);
    }
  }

  async requireWorkspaceRole(ctx: AuthContext, workspaceId: string, minimum: WorkspaceRole): Promise<WorkspaceRole> {
    const role = await this.workspaceRoleForUser(ctx.userId, workspaceId);
    if (!role || workspaceRank[role] < workspaceRank[minimum]) {
      throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "You do not have permission in this Workspace.");
    }
    return role;
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

    const effectiveRole = await this.projectRoleForUser(ctx.userId, workspaceId, workspaceRole, projectId, project.visibility);
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

  private async workspaceRoleForUser(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    const key = userId + ":" + workspaceId;
    const cached = this.workspaceCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        deletedAt: null,
        userId,
        workspace: { deletedAt: null, id: workspaceId },
      },
      select: { role: true },
    });
    const value = member?.role ?? null;
    this.workspaceCache.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    return value;
  }

  private async projectRoleForUser(
    userId: string,
    workspaceId: string,
    workspaceRole: WorkspaceRole,
    projectId: string,
    visibility: "WORKSPACE" | "PRIVATE",
  ): Promise<ProjectRole | null> {
    const key = userId + ":" + workspaceId + ":" + projectId;
    const cached = this.projectCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const explicit = await this.prisma.projectMember.findFirst({
      where: { deletedAt: null, projectId, userId },
      select: { role: true },
    });
    let value: ProjectRole | null;
    if (explicit) value = explicit.role;
    else if (visibility === "PRIVATE") value = null;
    else value = workspaceRole === "GUEST" ? "VIEWER" : "EDITOR";

    this.projectCache.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    return value;
  }
}
