import type { PrismaClient } from "@atlas/db";
import type { CreateProjectRequest, UpdateProjectRequest } from "@atlas/shared";

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
          { workspace: { members: { some: { role: { in: ["OWNER", "ADMIN"] }, userId: input.userId } } } },
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
}
