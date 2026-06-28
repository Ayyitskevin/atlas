import type { PrismaClient } from "@atlas/db";

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: { deletedAt: null, disabledAt: null, id: userId },
      select: { createdAt: true, email: true, id: true, name: true, updatedAt: true },
    });
  }

  createUser(input: { email: string; name: string; passwordHash: string }) {
    return this.prisma.user.create({ data: input });
  }

  createSession(input: {
    expiresAt: Date;
    ipAddress?: string;
    refreshTokenHash: string;
    tokenFamily: string;
    userAgent?: string;
    userId: string;
  }) {
    return this.prisma.session.create({ data: input });
  }

  findSessionByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findFirst({
      include: { user: true },
      where: { refreshTokenHash, revokedAt: null },
    });
  }

  revokeSession(sessionId: string) {
    return this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { id: sessionId, revokedAt: null },
    });
  }
}
