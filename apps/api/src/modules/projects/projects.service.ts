import {
  ATLAS_ERROR_CODES,
  type CreateProjectRequest,
  type CursorPaginationQuery,
  type UpdateProjectRequest,
} from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProjectsRepository } from "./projects.repository.js";

export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async create(ctx: AuthContext, workspaceId: string, input: CreateProjectRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "MEMBER");
    return this.projectsRepository.create({ ...input, createdById: ctx.userId, workspaceId });
  }

  async list(ctx: AuthContext, workspaceId: string, query: CursorPaginationQuery) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "GUEST");
    const items = await this.projectsRepository.list({ ...query, userId: ctx.userId, workspaceId });
    return pageFromLimit(items, query.limit);
  }

  async get(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    const project = await this.projectsRepository.find(workspaceId, projectId);
    if (!project) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project not found.");
    return project;
  }

  async update(ctx: AuthContext, workspaceId: string, projectId: string, input: UpdateProjectRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    return this.projectsRepository.update(workspaceId, projectId, input);
  }

  async archive(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    return this.projectsRepository.archive(workspaceId, projectId);
  }

  async delete(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    return this.projectsRepository.softDelete(workspaceId, projectId);
  }
}
