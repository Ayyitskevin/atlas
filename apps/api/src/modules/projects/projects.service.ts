import {
  ATLAS_ERROR_CODES,
  type CreateProjectRequest,
  type CursorPaginationQuery,
  type UpdateProjectRequest,
} from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { pageFromLimit } from "../../shared/pagination.js";
import { DomainEventsRepository } from "../events/domain-events.repository.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProjectsRepository } from "./projects.repository.js";

export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly events: DomainEventsRepository,
    private readonly permissions: PermissionsService,
  ) {}

  async create(ctx: AuthContext, workspaceId: string, input: CreateProjectRequest) {
    await this.permissions.requireWorkspaceRole(ctx, workspaceId, "MEMBER");
    const project = await this.projectsRepository.create({ ...input, createdById: ctx.userId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: project.id,
      entityType: "project",
      eventType: "ProjectCreated",
      payload: projectPayload(project),
      projectId: project.id,
      workspaceId,
    });
    return project;
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
    const project = await this.projectsRepository.update(workspaceId, projectId, input);
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: project.id,
      entityType: "project",
      eventType: "ProjectUpdated",
      payload: projectPayload(project),
      projectId: project.id,
      workspaceId,
    });
    return project;
  }

  async archive(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    const project = await this.projectsRepository.archive(workspaceId, projectId);
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: project.id,
      entityType: "project",
      eventType: "ProjectArchived",
      payload: projectPayload(project),
      projectId: project.id,
      workspaceId,
    });
    return project;
  }

  async delete(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    const project = await this.projectsRepository.softDelete(workspaceId, projectId);
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: project.id,
      entityType: "project",
      eventType: "ProjectDeleted",
      payload: projectPayload(project),
      projectId: project.id,
      workspaceId,
    });
    return project;
  }
}

function projectPayload(project: { archivedAt?: Date | null; description?: string | null; name: string; visibility: string }) {
  return {
    archivedAt: project.archivedAt?.toISOString() ?? null,
    description: project.description ?? null,
    name: project.name,
    visibility: project.visibility,
  };
}
