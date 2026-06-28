export const ATLAS_ERROR_CODES = {
  BAD_REQUEST: "ATLAS_BAD_REQUEST",
  CONFLICT: "ATLAS_CONFLICT",
  FORBIDDEN: "ATLAS_FORBIDDEN",
  INTERNAL: "ATLAS_INTERNAL",
  NOT_FOUND: "ATLAS_NOT_FOUND",
  RATE_LIMITED: "ATLAS_RATE_LIMITED",
  STALE_VERSION: "ATLAS_STALE_VERSION",
  UNAUTHORIZED: "ATLAS_UNAUTHORIZED",
  VALIDATION_FAILED: "ATLAS_VALIDATION_FAILED",
} as const;

export type AtlasErrorCode = (typeof ATLAS_ERROR_CODES)[keyof typeof ATLAS_ERROR_CODES];

export type AtlasErrorResponse = {
  error: {
    code: AtlasErrorCode;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
};
