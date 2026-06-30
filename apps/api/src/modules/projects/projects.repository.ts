import type { PrismaClient, ProjectRole } from "@atlas/db";
import type { AddProjectMemberRequest, CreateProjectRequest, UpdateProjectRequest } from "@atlas/shared";

import { paginationArgs } from "../../shared/pagination.js";

export class ProjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateProjectRequest & { createdById: string; workspaceId: string }) {
    return this.prisma.project.create({
      data: {
        createdById: input.createdById,
        description: input.description,
        name: input.name,
        visibility: input.visibility,
        workspaceId: input.workspaceId,
        members: { create: { role: "PROJECT_ADMIN", userId: input.createdById } },
      },
    });
  }

  list(input: { cursor?: string; limit: number; userId: string; workspaceId: string }) {
    return this.prisma.project.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        deletedAt: null,
        workspaceId: input.workspaceId,
        OR: [
          { visibility: "WORKSPACE" },
          { members: { some: { deletedAt: null, userId: input.userId } } },
          { workspace: { members: { some: { deletedAt: null, role: { in: ["OWNER", "ADMIN"] }, userId: input.userId } } } },
        ],
      },
    });
  }

  find(workspaceId: string, projectId: string) {
    return this.prisma.project.findFirst({ where: { deletedAt: null, id: projectId, workspaceId } });
  }

  update(workspaceId: string, projectId: string, input: UpdateProjectRequest) {
    return this.prisma.project.update({ data: input, where: { id: projectId, workspaceId } });
  }

  archive(workspaceId: string, projectId: string) {
    return this.prisma.project.update({ data: { archivedAt: new Date() }, where: { id: projectId, workspaceId } });
  }

  softDelete(workspaceId: string, projectId: string) {
    return this.prisma.project.update({ data: { deletedAt: new Date() }, where: { id: projectId, workspaceId } });
  }

  listMembers(workspaceId: string, projectId: string) {
    return this.prisma.projectMember.findMany({
      include: { user: { select: { email: true, id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      where: { deletedAt: null, project: { deletedAt: null, id: projectId, workspaceId } },
    });
  }

  findActiveWorkspaceMember(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.findFirst({
      where: {
        deletedAt: null,
        user: { deletedAt: null, disabledAt: null },
        userId: input.userId,
        workspaceId: input.workspaceId,
        workspace: { deletedAt: null },
      },
    });
  }

  findActiveMember(input: { projectId: string; userId: string }) {
    return this.prisma.projectMember.findFirst({
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { deletedAt: null, projectId: input.projectId, userId: input.userId },
    });
  }

  countProjectAdmins(projectId: string) {
    return this.prisma.projectMember.count({
      where: { deletedAt: null, projectId, role: "PROJECT_ADMIN" },
    });
  }

  addMember(input: AddProjectMemberRequest & { projectId: string }) {
    return this.prisma.projectMember.upsert({
      create: {
        projectId: input.projectId,
        role: input.role as ProjectRole,
        userId: input.userId,
      },
      include: { user: { select: { email: true, id: true, name: true } } },
      update: {
        deletedAt: null,
        role: input.role as ProjectRole,
      },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }

  updateMemberRole(input: { projectId: string; role: ProjectRole; userId: string }) {
    return this.prisma.projectMember.update({
      data: { role: input.role },
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }

  removeMember(input: { projectId: string; userId: string }) {
    return this.prisma.projectMember.update({
      data: { deletedAt: new Date() },
      include: { user: { select: { email: true, id: true, name: true } } },
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
    });
  }
}
