import type { FastifySchema } from "fastify";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z, type ZodTypeAny } from "zod";

const emptyObjectSchema = z.object({}).strict();
const atlasErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    details: z.record(z.unknown()),
    message: z.string(),
    requestId: z.string(),
  }),
});

export function openApiSchema(input: {
  body?: ZodTypeAny;
  description?: string;
  params?: ZodTypeAny;
  querystring?: ZodTypeAny;
  response?: Record<number, ZodTypeAny>;
  tags: string[];
}): FastifySchema {
  const response = {
    400: atlasErrorResponseSchema,
    401: atlasErrorResponseSchema,
    403: atlasErrorResponseSchema,
    404: atlasErrorResponseSchema,
    409: atlasErrorResponseSchema,
    429: atlasErrorResponseSchema,
    500: atlasErrorResponseSchema,
    ...input.response,
  };

  return {
    ...(input.body ? { body: zodToJsonSchema(input.body) } : {}),
    description: input.description,
    params: zodToJsonSchema(input.params ?? emptyObjectSchema),
    querystring: zodToJsonSchema(input.querystring ?? emptyObjectSchema),
    response: Object.fromEntries(Object.entries(response).map(([status, schema]) => [status, zodToJsonSchema(schema)])),
    tags: input.tags,
  };
}
