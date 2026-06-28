import type { FastifySchema } from "fastify";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

export function openApiSchema(input: {
  body?: ZodTypeAny;
  description?: string;
  params?: ZodTypeAny;
  querystring?: ZodTypeAny;
  tags: string[];
}): FastifySchema {
  return {
    body: input.body ? zodToJsonSchema(input.body) : undefined,
    description: input.description,
    params: input.params ? zodToJsonSchema(input.params) : undefined,
    querystring: input.querystring ? zodToJsonSchema(input.querystring) : undefined,
    tags: input.tags,
  };
}
