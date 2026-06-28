import type { AtlasErrorCode } from "@atlas/shared";

export class AtlasHttpError extends Error {
  readonly code: AtlasErrorCode;
  readonly details: Record<string, unknown>;
  readonly statusCode: number;

  constructor(statusCode: number, code: AtlasErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}
