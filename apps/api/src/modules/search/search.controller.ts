import type { FastifyRequest } from "fastify";
import { z } from "zod";

import {
  searchQuerySchema
} from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseParams, parseQuery } from "../../shared/validation.js";
import { WorkService } from "../work/work.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });

export class SearchController {
  constructor(private readonly workService: WorkService) {}

  search = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.workService.search(await requireAuth(request), workspaceId, parseQuery(request, searchQuerySchema));
  };
}
