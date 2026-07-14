import type { PrismaClient } from "@atlas/db";

export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: { deletedAt: null, disabledAt: null, id: userId },
      select: {
        createdAt: true,
        email: true,
        emailVerifiedAt: true,
        id: true,
        name: true,
        updatedAt: true,
      },
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
      where: { refreshTokenHash },
    });
  }

  listActiveSessionsForUser(userId: string) {
    return this.prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        ipAddress: true,
        userAgent: true,
      },
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
        userId,
      },
    });
  }

  revokeSession(sessionId: string) {
    return this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { id: sessionId, revokedAt: null },
    });
  }

  revokeSessionForUser(input: { sessionId: string; userId: string }) {
    return this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { id: input.sessionId, revokedAt: null, userId: input.userId },
    });
  }

  revokeOtherSessions(input: { currentSessionId: string; userId: string }) {
    return this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { id: { not: input.currentSessionId }, revokedAt: null, userId: input.userId },
    });
  }

  revokeTokenFamily(input: { tokenFamily: string; userId: string }) {
    return this.prisma.session.updateMany({
      data: { revokedAt: new Date() },
      where: { revokedAt: null, tokenFamily: input.tokenFamily, userId: input.userId },
    });
  }

  createEmailVerificationToken(input: { expiresAt: Date; tokenHash: string; userId: string }) {
    return this.prisma.emailVerificationToken.create({ data: input });
  }

  findEmailVerificationToken(tokenHash: string) {
    return this.prisma.emailVerificationToken.findFirst({
      include: { user: true },
      where: { tokenHash, usedAt: null },
    });
  }

  markEmailVerified(userId: string, tokenId: string) {
    return this.prisma.$transaction([
      this.prisma.user.update({
        data: { emailVerifiedAt: new Date() },
        where: { id: userId },
      }),
      this.prisma.emailVerificationToken.update({
        data: { usedAt: new Date() },
        where: { id: tokenId },
      }),
    ]);
  }

  createPasswordResetToken(input: { expiresAt: Date; tokenHash: string; userId: string }) {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  findPasswordResetToken(tokenHash: string) {
    return this.prisma.passwordResetToken.findFirst({
      include: { user: true },
      where: { tokenHash, usedAt: null },
    });
  }

  consumePasswordReset(input: { passwordHash: string; tokenId: string; userId: string }) {
    return this.prisma.$transaction([
      this.prisma.user.update({
        data: { passwordHash: input.passwordHash },
        where: { id: input.userId },
      }),
      this.prisma.passwordResetToken.update({
        data: { usedAt: new Date() },
        where: { id: input.tokenId },
      }),
      this.prisma.session.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId: input.userId },
      }),
    ]);
  }
}
