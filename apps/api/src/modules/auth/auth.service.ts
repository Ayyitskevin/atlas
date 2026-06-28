import argon2 from "argon2";
import { randomUUID } from "node:crypto";

import { ATLAS_ERROR_CODES, type LoginRequest, type RefreshRequest, type RegisterRequest } from "@atlas/shared";

import type { AuthContext } from "../../shared/auth-context.js";
import { signAccessToken } from "../../shared/auth-context.js";
import { createOpaqueToken, hashToken } from "../../shared/crypto.js";
import { AtlasHttpError } from "../../shared/errors.js";
import { AuthRepository } from "./auth.repository.js";

const refreshTtlMs = 1000 * 60 * 60 * 24 * 30;

export class AuthService {
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
    const session = await this.authRepository.findSessionByRefreshHash(hashToken(input.refreshToken));
    if (!session || session.expiresAt < new Date() || session.user.deletedAt || session.user.disabledAt) {
      throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid refresh token.");
    }

    await this.authRepository.revokeSession(session.id);
    return this.createTokenPair(session.userId, context, session.tokenFamily as ReturnType<typeof randomUUID>);
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

  private async createTokenPair(
    userId: string,
    context: Pick<AuthContext, "ip" | "userAgent">,
    tokenFamily = randomUUID(),
  ) {
    const refreshToken = createOpaqueToken();
    const session = await this.authRepository.createSession({
      expiresAt: new Date(Date.now() + refreshTtlMs),
      ipAddress: context.ip,
      refreshTokenHash: hashToken(refreshToken),
      tokenFamily: tokenFamily as ReturnType<typeof randomUUID>,
      userAgent: context.userAgent,
      userId,
    });

    return {
      accessToken: signAccessToken({ sessionId: session.id, userId }),
      refreshToken,
      tokenType: "Bearer",
    };
  }
}
