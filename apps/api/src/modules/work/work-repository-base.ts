import type { Prisma, PrismaClient } from "@atlas/db";

/** Shared Prisma handle + cross-domain query helpers for work repositories. */
export class WorkRepositoryBase {
  constructor(protected readonly prisma: PrismaClient) {}

  protected accessibleProjectWhere(userId: string, workspaceId: string): Prisma.ProjectWhereInput {
    return {
      deletedAt: null,
      workspaceId,
      OR: [
        { visibility: "WORKSPACE" },
        { members: { some: { userId } } },
        { workspace: { members: { some: { role: { in: ["OWNER", "ADMIN"] }, userId } } } },
      ],
    };
  }
}
