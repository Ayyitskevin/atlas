import argon2 from "argon2";
import { randomUUID } from "node:crypto";

import {
  ATLAS_ERROR_CODES,
  type LoginRequest,
  type RefreshRequest,
  type RegisterRequest,
  type RequestPasswordResetRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
} from "@atlas/shared";

import { env } from "../../config/env.js";
import { createEmailProvider } from "../../email/email-provider.js";
import type { AuthContext } from "../../shared/auth-context.js";
import { signAccessToken } from "../../shared/auth-context.js";
import { createOpaqueToken, hashToken } from "../../shared/crypto.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { AuthRepository } from "./auth.repository.js";

const refreshTtlMs = 1000 * 60 * 60 * 24 * 30;
const emailTokenTtlMs = 1000 * 60 * 60 * 24;
const passwordResetTtlMs = 1000 * 60 * 60;

export class AuthService {
  private readonly emailProvider = createEmailProvider({
    from: env.EMAIL_FROM,
    provider: env.EMAIL_PROVIDER,
    resendApiKey: env.RESEND_API_KEY,
    resendApiUrl: env.RESEND_API_URL,
  });

  constructor(private readonly authRepository: AuthRepository) {}

  async register(input: RegisterRequest, context: Pick<AuthContext, "ip" | "userAgent">) {
    const existing = await this.authRepository.findUserByEmail(input.email.toLowerCase());
    if (existing) {
      throw new AtlasHttpError(409, ATLAS_ERROR_CODES.CONFLICT, "A user with that email already exists.");
    }

    const user = await this.authRepository.createUser({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await argon2.hash(input.password),
    });

    await this.issueEmailVerification(user.id, user.email, user.name);
    return this.createTokenPair(user.id, context);
  }

  async login(input: LoginRequest, context: Pick<AuthContext, "ip" | "userAgent">) {
    const user = await this.authRepository.findUserByEmail(input.email.toLowerCase());
    if (!user || user.deletedAt || user.disabledAt || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid email or password.");
    }

    return this.createTokenPair(user.id, context);
  }

  async refresh(input: RefreshRequest, context: Pick<AuthContext, "ip" | "userAgent">) {
    const refreshToken = input.refreshToken;
    if (!refreshToken) {
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid refresh token.");
    }

    const session = await this.authRepository.findSessionByRefreshHash(hashToken(refreshToken));
    if (!session) {
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid refresh token.");
    }

    if (session.revokedAt) {
      await this.authRepository.revokeTokenFamily({ tokenFamily: session.tokenFamily, userId: session.userId });
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid refresh token.");
    }

    if (session.expiresAt < new Date() || session.user.deletedAt || session.user.disabledAt) {
      await this.authRepository.revokeSession(session.id);
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid refresh token.");
    }

    await this.authRepository.revokeSession(session.id);
    return this.createTokenPair(session.userId, context, session.tokenFamily);
  }

  async logout(ctx: AuthContext) {
    await this.authRepository.revokeSession(ctx.sessionId);
    return { ok: true };
  }

  async me(ctx: AuthContext) {
    const user = await this.authRepository.findUserById(ctx.userId);
    if (!user) throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "User no longer exists.");
    return { user };
  }

  async listSessions(ctx: AuthContext) {
    const sessions = await this.authRepository.listActiveSessionsForUser(ctx.userId);
    return {
      items: sessions.map((session) => ({
        ...session,
        current: session.id === ctx.sessionId,
      })),
    };
  }

  async revokeSession(ctx: AuthContext, sessionId: string) {
    const result = await this.authRepository.revokeSessionForUser({ sessionId, userId: ctx.userId });
    if (result.count === 0) {
      throw new AtlasHttpError(404, ATLAS_ERROR_CODES.NOT_FOUND, "Session not found.");
    }
    return { ok: true };
  }

  async revokeOtherSessions(ctx: AuthContext) {
    const result = await this.authRepository.revokeOtherSessions({ currentSessionId: ctx.sessionId, userId: ctx.userId });
    return { revokedCount: result.count };
  }

  async requestEmailVerification(ctx: AuthContext) {
    const user = await this.authRepository.findUserById(ctx.userId);
    if (!user) throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "User no longer exists.");
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
    await this.issueEmailVerification(user.id, user.email, user.name);
    return { ok: true, alreadyVerified: false };
  }

  async verifyEmail(input: VerifyEmailRequest) {
    const record = await this.authRepository.findEmailVerificationToken(hashToken(input.token));
    if (!record || record.expiresAt < new Date() || record.user.deletedAt || record.user.disabledAt) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Invalid or expired verification token.");
    }
    await this.authRepository.markEmailVerified(record.userId, record.id);
    return { ok: true };
  }

  async requestPasswordReset(input: RequestPasswordResetRequest) {
    const user = await this.authRepository.findUserByEmail(input.email.toLowerCase());
    // Always return ok to avoid email enumeration.
    if (!user || user.deletedAt || user.disabledAt) return { ok: true };

    const token = createOpaqueToken();
    await this.authRepository.createPasswordResetToken({
      expiresAt: new Date(Date.now() + passwordResetTtlMs),
      tokenHash: hashToken(token),
      userId: user.id,
    });

    const resetLink = env.WEB_ORIGIN.replace(/\/+$/, "") + "/login?resetToken=" + encodeURIComponent(token);
    await this.emailProvider.send({
      metadata: { userId: user.id, kind: "password_reset" },
      subject: "Reset your Atlas password",
      text:
        "We received a request to reset your Atlas password.\n\n" +
        "Reset link (expires in 1 hour):\n" +
        resetLink +
        "\n\nIf you did not request this, you can ignore this email.",
      to: [{ email: user.email, name: user.name }],
    });

    return { ok: true };
  }

  async resetPassword(input: ResetPasswordRequest) {
    const record = await this.authRepository.findPasswordResetToken(hashToken(input.token));
    if (!record || record.expiresAt < new Date() || record.user.deletedAt || record.user.disabledAt) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.BAD_REQUEST, "Invalid or expired password reset token.");
    }
    await this.authRepository.consumePasswordReset({
      passwordHash: await argon2.hash(input.password),
      tokenId: record.id,
      userId: record.userId,
    });
    return { ok: true };
  }

  private async issueEmailVerification(userId: string, email: string, name: string) {
    const token = createOpaqueToken();
    await this.authRepository.createEmailVerificationToken({
      expiresAt: new Date(Date.now() + emailTokenTtlMs),
      tokenHash: hashToken(token),
      userId,
    });
    const verifyLink = env.WEB_ORIGIN.replace(/\/+$/, "") + "/login?verifyToken=" + encodeURIComponent(token);
    await this.emailProvider.send({
      metadata: { userId, kind: "email_verification" },
      subject: "Verify your Atlas email",
      text:
        "Welcome to Atlas, " +
        name +
        ".\n\nVerify your email:\n" +
        verifyLink +
        "\n\nThis link expires in 24 hours.",
      to: [{ email, name }],
    });
  }

  private async createTokenPair(userId: string, context: Pick<AuthContext, "ip" | "userAgent">, tokenFamily: string = randomUUID()) {
    const refreshToken = createOpaqueToken();
    const session = await this.authRepository.createSession({
      expiresAt: new Date(Date.now() + refreshTtlMs),
      ipAddress: context.ip,
      refreshTokenHash: hashToken(refreshToken),
      tokenFamily,
      userAgent: context.userAgent,
      userId,
    });

    return {
      accessToken: signAccessToken({ sessionId: session.id, userId }),
      refreshToken,
      tokenType: "Bearer" as const,
    };
  }
}
