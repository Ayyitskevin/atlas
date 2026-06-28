import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

import { prisma } from "@atlas/db";
import { ATLAS_ERROR_CODES } from "@atlas/shared";

import { env } from "../config/env.js";
import { AtlasHttpError } from "./errors.js";

export type AuthContext = {
  ip: string;
  sessionId: string;
  userAgent?: string;
  userId: string;
};

type AccessTokenClaims = {
  sid: string;
  sub: string;
  typ: "access";
};

export function signAccessToken(input: { sessionId: string; userId: string }): string {
  return jwt.sign({ sid: input.sessionId, typ: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
    subject: input.userId,
  });
}

export async function requireAuth(request: FastifyRequest): Promise<AuthContext> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Authentication required.");
  }
  return authenticateAccessToken(request, header.slice("Bearer ".length));
}

export async function requireAuthToken(request: FastifyRequest, accessToken: string | undefined): Promise<AuthContext> {
  if (!accessToken) {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Authentication required.");
  }
  return authenticateAccessToken(request, accessToken);
}

async function authenticateAccessToken(request: FastifyRequest, accessToken: string): Promise<AuthContext> {
  let claims: AccessTokenClaims;
  try {
    claims = jwt.verify(accessToken, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
    if (claims.typ !== "access" || !claims.sub || !claims.sid) {
      throw new Error("Invalid token claims");
    }
  } catch {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid or expired access token.");
  }

  const session = await prisma.session.findFirst({
    select: { user: { select: { deletedAt: true, disabledAt: true } } },
    where: {
      expiresAt: { gt: new Date() },
      id: claims.sid,
      revokedAt: null,
      userId: claims.sub,
    },
  });
  if (!session || session.user.deletedAt || session.user.disabledAt) {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid or expired access token.");
  }

  return {
    ip: request.ip,
    sessionId: claims.sid,
    userAgent: request.headers["user-agent"],
    userId: claims.sub,
  };
}
