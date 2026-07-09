import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { searchQuerySchema, searchResponseSchema } from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { createWorkService } from "../work/create-work-service.js";
import { SearchController } from "./search.controller.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  const controller = new SearchController(createWorkService());

  app.get(
    "/workspaces/:workspaceId/search",
    {
      schema: openApiSchema({
        params: workspaceParamsSchema,
        querystring: searchQuerySchema,
        response: { 200: searchResponseSchema },
        tags: ["Search"],
      }),
    },
    controller.search,
  );
}
