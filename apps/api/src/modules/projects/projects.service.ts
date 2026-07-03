import {
  ATLAS_ERROR_CODES,
  type AddProjectMemberRequest,
  type CreateProjectMessageRequest,
  type CreateProjectRequest,
  type CursorPaginationQuery,
  type UpdateProjectMessageRequest,
  type UpdateProjectMemberRequest,
  type UpdateProjectRequest,
} from "@atlas/shared";
import type { ProjectRole } from "@atlas/db";

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

  async listMembers(ctx: AuthContext, workspaceId: string, projectId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    return { items: await this.projectsRepository.listMembers(workspaceId, projectId) };
  }

  async addMember(ctx: AuthContext, workspaceId: string, projectId: string, input: AddProjectMemberRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    const workspaceMember = await this.projectsRepository.findActiveWorkspaceMember({ userId: input.userId, workspaceId });
    if (!workspaceMember) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "User must be an active member of this Workspace.");
    }

    const existing = await this.projectsRepository.findActiveMember({ projectId, userId: input.userId });
    if (existing) throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "User is already a Project member.");

    const member = await this.projectsRepository.addMember({ ...input, projectId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: member.id,
      entityType: "project_member",
      eventType: "ProjectMemberAdded",
      payload: projectMemberPayload(member),
      projectId,
      workspaceId,
    });
    return member;
  }

  async updateMember(ctx: AuthContext, workspaceId: string, projectId: string, userId: string, input: UpdateProjectMemberRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    const member = await this.projectsRepository.findActiveMember({ projectId, userId });
    if (!member) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project member not found.");
    await this.ensureProjectAdminCanChange(projectId, member.role as ProjectRole, input.role as ProjectRole);

    const updated = await this.projectsRepository.updateMemberRole({ projectId, role: input.role as ProjectRole, userId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: updated.id,
      entityType: "project_member",
      eventType: "ProjectMemberUpdated",
      payload: projectMemberPayload(updated, member.role),
      projectId,
      workspaceId,
    });
    return updated;
  }

  async removeMember(ctx: AuthContext, workspaceId: string, projectId: string, userId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "PROJECT_ADMIN");
    const member = await this.projectsRepository.findActiveMember({ projectId, userId });
    if (!member) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project member not found.");
    await this.ensureProjectAdminCanChange(projectId, member.role as ProjectRole, null);

    const removed = await this.projectsRepository.removeMember({ projectId, userId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: removed.id,
      entityType: "project_member",
      eventType: "ProjectMemberRemoved",
      payload: projectMemberPayload(removed),
      projectId,
      workspaceId,
    });
    return { ok: true };
  }

  async listMessages(ctx: AuthContext, workspaceId: string, projectId: string, query: CursorPaginationQuery) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "VIEWER");
    const items = await this.projectsRepository.listMessages({ ...query, projectId, workspaceId });
    return pageFromLimit(items, query.limit);
  }

  async createMessage(ctx: AuthContext, workspaceId: string, projectId: string, input: CreateProjectMessageRequest) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "COMMENTER");
    const message = await this.projectsRepository.createMessage({
      authorId: ctx.userId,
      body: input.body,
      projectId,
      title: input.title,
      workspaceId,
    });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: message.id,
      entityType: "project_message",
      eventType: "ProjectMessageCreated",
      payload: projectMessagePayload(message),
      projectId,
      workspaceId,
    });
    return message;
  }

  async updateMessage(ctx: AuthContext, workspaceId: string, projectId: string, messageId: string, input: UpdateProjectMessageRequest) {
    const message = await this.projectsRepository.findMessage({ messageId, projectId, workspaceId });
    if (!message) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.requireMessageMutationRole(ctx, workspaceId, projectId, message.authorId);
    const updated = await this.projectsRepository.updateMessage({
      body: input.body,
      messageId,
      projectId,
      title: input.title,
      workspaceId,
    });
    if (!updated) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: updated.id,
      entityType: "project_message",
      eventType: "ProjectMessageUpdated",
      payload: projectMessagePayload(updated, message),
      projectId,
      workspaceId,
    });
    return updated;
  }

  async deleteMessage(ctx: AuthContext, workspaceId: string, projectId: string, messageId: string) {
    const message = await this.projectsRepository.findMessage({ messageId, projectId, workspaceId });
    if (!message) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.requireMessageMutationRole(ctx, workspaceId, projectId, message.authorId);
    await this.projectsRepository.softDeleteMessage({ messageId, projectId, workspaceId });
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: message.id,
      entityType: "project_message",
      eventType: "ProjectMessageDeleted",
      payload: projectMessagePayload(message),
      projectId,
      workspaceId,
    });
    return { ok: true };
  }

  async pinMessage(ctx: AuthContext, workspaceId: string, projectId: string, messageId: string) {
    const message = await this.projectsRepository.findMessage({ messageId, projectId, workspaceId });
    if (!message) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const pinned = await this.projectsRepository.pinMessage({ messageId, pinnedById: ctx.userId, projectId, workspaceId });
    if (!pinned) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: pinned.id,
      entityType: "project_message",
      eventType: "ProjectMessagePinned",
      payload: projectMessagePayload(pinned),
      projectId,
      workspaceId,
    });
    return pinned;
  }

  async unpinMessage(ctx: AuthContext, workspaceId: string, projectId: string, messageId: string) {
    const message = await this.projectsRepository.findMessage({ messageId, projectId, workspaceId });
    if (!message) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, "EDITOR");
    const unpinned = await this.projectsRepository.unpinMessage({ messageId, projectId, workspaceId });
    if (!unpinned) throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Project message not found.");
    await this.events.recordActivity({
      actorUserId: ctx.userId,
      entityId: unpinned.id,
      entityType: "project_message",
      eventType: "ProjectMessageUnpinned",
      payload: projectMessagePayload(message),
      projectId,
      workspaceId,
    });
    return unpinned;
  }

  private async requireMessageMutationRole(ctx: AuthContext, workspaceId: string, projectId: string, authorId: string) {
    await this.permissions.requireProjectRole(ctx, workspaceId, projectId, authorId === ctx.userId ? "COMMENTER" : "EDITOR");
  }

  private async ensureProjectAdminCanChange(projectId: string, currentRole: ProjectRole, nextRole: ProjectRole | null) {
    if (currentRole !== "PROJECT_ADMIN" || nextRole === "PROJECT_ADMIN") return;
    const projectAdminCount = await this.projectsRepository.countProjectAdmins(projectId);
    if (projectAdminCount <= 1) {
      throw new AtlasHttpError(403, ATLAS_ERROR_CODES.FORBIDDEN, "Projects must keep at least one Project admin.");
    }
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

function projectMemberPayload(
  member: {
    role: string;
    user: { email: string; id: string; name: string };
    userId: string;
  },
  previousRole?: string,
) {
  return {
    previousRole: previousRole ?? null,
    role: member.role,
    user: member.user,
    userId: member.userId,
  };
}

function projectMessagePayload(
  message: { body: string; pinnedAt?: Date | null; title: string },
  previous?: { body: string; title: string },
) {
  const payload: Record<string, string | null> = {
    bodyPreview: message.body.slice(0, 160),
    pinnedAt: message.pinnedAt?.toISOString() ?? null,
    title: message.title,
  };
  if (!previous) return payload;
  if (previous.title !== message.title) payload.previousTitle = previous.title;
  if (previous.body !== message.body) payload.previousBodyPreview = previous.body.slice(0, 160);
  return payload;
}
