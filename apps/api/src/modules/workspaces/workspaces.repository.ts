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

  findUserById(userId: string) {
    return this.prisma.user.findFirst({ where: { deletedAt: null, disabledAt: null, id: userId } });
  }

  findActiveMember(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.findFirst({
      where: { deletedAt: null, userId: input.userId, workspaceId: input.workspaceId },
    });
  }

  upsertMember(input: { invitedById?: string; role: WorkspaceRole; userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.upsert({
      create: {
        invitedById: input.invitedById,
        joinedAt: new Date(),
        role: input.role,
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
      update: { deletedAt: null, invitedById: input.invitedById, joinedAt: new Date(), role: input.role },
      where: { workspaceId_userId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  }

  createInvitation(input: { email: string; expiresAt: Date; invitedById: string; role: WorkspaceRole; tokenHash: string; workspaceId: string }) {
    return this.prisma.workspaceInvitation.create({
      data: input,
      select: invitationSelect,
    });
  }

  findActiveInvitationByEmail(input: { email: string; workspaceId: string }) {
    return this.prisma.workspaceInvitation.findFirst({
      select: invitationSelect,
      where: {
        acceptedAt: null,
        canceledAt: null,
        declinedAt: null,
        email: input.email,
        expiresAt: { gt: new Date() },
        workspaceId: input.workspaceId,
      },
    });
  }

  listInvitations(workspaceId: string) {
    return this.prisma.workspaceInvitation.findMany({
      orderBy: { createdAt: "desc" },
      select: invitationSelect,
      where: {
        acceptedAt: null,
        canceledAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
        workspaceId,
      },
    });
  }

  findInvitationByTokenHash(tokenHash: string) {
    return this.prisma.workspaceInvitation.findFirst({
      select: { ...invitationSelect, tokenHash: true },
      where: { tokenHash },
    });
  }

  acceptInvitation(input: { acceptedById: string; invitationId: string; invitedById: string; role: WorkspaceRole; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceInvitation.updateMany({
        data: { acceptedAt: new Date(), acceptedById: input.acceptedById },
        where: {
          acceptedAt: null,
          canceledAt: null,
          declinedAt: null,
          expiresAt: { gt: new Date() },
          id: input.invitationId,
          workspaceId: input.workspaceId,
        },
      });
      if (updated.count === 0) return null;

      return tx.workspaceMember.upsert({
        create: {
          invitedById: input.invitedById,
          joinedAt: new Date(),
          role: input.role,
          userId: input.acceptedById,
          workspaceId: input.workspaceId,
        },
        update: { deletedAt: null, invitedById: input.invitedById, joinedAt: new Date(), role: input.role },
        where: { workspaceId_userId: { userId: input.acceptedById, workspaceId: input.workspaceId } },
      });
    });
  }

  cancelInvitation(input: { invitationId: string; workspaceId: string }) {
    return this.prisma.workspaceInvitation.updateMany({
      data: { canceledAt: new Date() },
      where: { acceptedAt: null, canceledAt: null, id: input.invitationId, workspaceId: input.workspaceId },
    });
  }

  resendInvitation(input: { expiresAt: Date; invitationId: string; tokenHash: string; workspaceId: string }) {
    return this.prisma.workspaceInvitation.updateMany({
      data: { expiresAt: input.expiresAt, tokenHash: input.tokenHash },
      where: {
        acceptedAt: null,
        canceledAt: null,
        declinedAt: null,
        id: input.invitationId,
        workspaceId: input.workspaceId,
      },
    });
  }

  updateMemberRole(input: { role: WorkspaceRole; userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.updateMany({
      data: { role: input.role },
      where: { deletedAt: null, role: { not: "OWNER" }, userId: input.userId, workspaceId: input.workspaceId },
    });
  }

  removeMember(input: { userId: string; workspaceId: string }) {
    return this.prisma.workspaceMember.updateMany({
      data: { deletedAt: new Date() },
      where: { deletedAt: null, role: { not: "OWNER" }, userId: input.userId, workspaceId: input.workspaceId },
    });
  }

  transferOwnership(input: { newOwnerId: string; previousOwnerId: string; workspaceId: string }) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.workspaceMember.findFirst({
        where: { deletedAt: null, userId: input.newOwnerId, workspaceId: input.workspaceId },
      });
      if (!target) return null;

      await tx.workspace.update({ data: { ownerId: input.newOwnerId }, where: { id: input.workspaceId } });
      await tx.workspaceMember.updateMany({
        data: { role: "ADMIN" },
        where: { deletedAt: null, role: "OWNER", userId: input.previousOwnerId, workspaceId: input.workspaceId },
      });
      return tx.workspaceMember.update({
        data: { role: "OWNER" },
        where: { workspaceId_userId: { userId: input.newOwnerId, workspaceId: input.workspaceId } },
      });
    });
  }
}

const invitationSelect = {
  acceptedAt: true,
  canceledAt: true,
  createdAt: true,
  declinedAt: true,
  email: true,
  expiresAt: true,
  id: true,
  invitedById: true,
  role: true,
  workspaceId: true,
} as const;
