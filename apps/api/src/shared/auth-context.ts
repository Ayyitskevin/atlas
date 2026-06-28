import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

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

export function requireAuth(request: FastifyRequest): AuthContext {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Authentication required.");
  }

  try {
    const claims = jwt.verify(header.slice("Bearer ".length), env.JWT_ACCESS_SECRET) as AccessTokenClaims;
    if (claims.typ !== "access" || !claims.sub || !claims.sid) {
      throw new Error("Invalid token claims");
    }
    return {
      ip: request.ip,
      sessionId: claims.sid,
      userAgent: request.headers["user-agent"],
      userId: claims.sub,
    };
  } catch {
    throw new AtlasHttpError(401, ATLAS_ERROR_CODES.UNAUTHORIZED, "Invalid or expired access token.");
  }
}
