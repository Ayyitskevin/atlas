import type { PrismaClient, WorkspaceRole } from "@atlas/db";

import { paginationArgs } from "../../shared/pagination.js";

export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: { name: string; ownerId: string; slug: string }) {
    return this.prisma.workspace.create({
      data: {
        name: input.name,
        ownerId: input.ownerId,
        slug: input.slug,
        members: {
          create: { joinedAt: new Date(), role: "OWNER", userId: input.ownerId },
        },
      },
    });
  }

  listForUser(input: { cursor?: string; limit: number; userId: string }) {
    return this.prisma.workspace.findMany({
      ...paginationArgs(input),
      orderBy: { createdAt: "desc" },
      where: {
        deletedAt: null,
        members: { some: { deletedAt: null, userId: input.userId } },
      },
    });
  }

  findById(workspaceId: string) {
    return this.prisma.workspace.findFirst({ where: { deletedAt: null, id: workspaceId } });
  }

  update(workspaceId: string, input: { name?: string; slug?: string }) {
    return this.prisma.workspace.update({ data: input, where: { id: workspaceId } });
  }

  softDelete(workspaceId: string) {
    return this.prisma.workspace.update({ data: { deletedAt: new Date() }, where: { id: workspaceId } });
  }

  listMembers(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      include: { user: { select: { email: true, id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      where: { deletedAt: null, workspaceId },
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  upsertMember(input: { invitedById: string; role: WorkspaceRole; userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.upsert({
      create: {
        invitedById: input.invitedById,
        joinedAt: new Date(),
        role: input.role,
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
      update: { deletedAt: null, invitedById: input.invitedById, role: input.role },
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }
}
