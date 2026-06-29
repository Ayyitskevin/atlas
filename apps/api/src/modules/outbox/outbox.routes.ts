import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "@atlas/db";
import { outboxQuerySchema, replayOutboxEventResponseSchema } from "@atlas/shared";

import { openApiSchema } from "../../shared/zod-openapi.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { OutboxController } from "./outbox.controller.js";
import { OutboxRepository } from "./outbox.repository.js";
import { OutboxService } from "./outbox.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
const outboxParamsSchema = workspaceParamsSchema.extend({ outboxEventId: z.string().uuid() });

export async function registerOutboxRoutes(app: FastifyInstance): Promise<void> {
  const controller = new OutboxController(new OutboxService(new OutboxRepository(prisma), new PermissionsService(prisma)));

  app.get("/workspaces/:workspaceId/outbox", { schema: openApiSchema({ params: workspaceParamsSchema, querystring: outboxQuerySchema, tags: ["Outbox"] }) }, controller.list);
  app.post("/workspaces/:workspaceId/outbox/:outboxEventId/replay", { schema: openApiSchema({ params: outboxParamsSchema, response: { 200: replayOutboxEventResponseSchema }, tags: ["Outbox"] }) }, controller.replay);
}
