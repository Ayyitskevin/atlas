import type { FastifyRequest } from "fastify";
import { z } from "zod";

import { outboxQuerySchema } from "@atlas/shared";

import { requireAuth } from "../../shared/auth-context.js";
import { parseParams, parseQuery } from "../../shared/validation.js";
import { OutboxService } from "./outbox.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const outboxParamsSchema = workspaceParamsSchema.extend({ outboxEventId: z.string().uuid() });

export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  list = async (request: FastifyRequest) => {
    const { workspaceId } = parseParams(request, workspaceParamsSchema);
    return this.outboxService.list(await requireAuth(request), workspaceId, parseQuery(request, outboxQuerySchema));
  };

  get = async (request: FastifyRequest) => {
    const { outboxEventId, workspaceId } = parseParams(request, outboxParamsSchema);
    return this.outboxService.get(await requireAuth(request), workspaceId, outboxEventId);
  };

  replay = async (request: FastifyRequest) => {
    const { outboxEventId, workspaceId } = parseParams(request, outboxParamsSchema);
    return this.outboxService.replay(await requireAuth(request), workspaceId, outboxEventId);
  };
}
