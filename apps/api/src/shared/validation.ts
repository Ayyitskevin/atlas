import type { FastifyRequest } from "fastify";
import { type z, type ZodTypeAny, ZodError } from "zod";

import { ATLAS_ERROR_CODES } from "@atlas/shared";

import { AtlasHttpError } from "./errors.js";

export function parseBody<TSchema extends ZodTypeAny>(request: FastifyRequest, schema: TSchema): z.output<TSchema> {
  return parseWithSchema(request.body, schema);
}

export function parseParams<TSchema extends ZodTypeAny>(request: FastifyRequest, schema: TSchema): z.output<TSchema> {
  return parseWithSchema(request.params, schema);
}

export function parseQuery<TSchema extends ZodTypeAny>(request: FastifyRequest, schema: TSchema): z.output<TSchema> {
  return parseWithSchema(request.query, schema);
}

function parseWithSchema<TSchema extends ZodTypeAny>(input: unknown, schema: TSchema): z.output<TSchema> {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AtlasHttpError(400, ATLAS_ERROR_CODES.VALIDATION_FAILED, "Request validation failed.", {
        issues: error.issues,
      });
    }
    throw error;
  }
}
