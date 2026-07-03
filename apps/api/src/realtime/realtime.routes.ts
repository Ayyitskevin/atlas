import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "@atlas/db";

import { requireAuthToken } from "../shared/auth-context.js";
import { AtlasHttpError } from "../shared/errors.js";
import { PermissionsService } from "../modules/permissions/permissions.service.js";
import { realtimeHub } from "./realtime.hub.js";

const subscribeMessageSchema = z.object({
  action: z.literal("subscribe"),
  id: z.string().uuid(),
  scope: z.enum(["workspace", "project", "task"]),
});

export async function registerRealtimeRoutes(app: FastifyInstance): Promise<void> {
  const permissions = new PermissionsService(prisma);

  app.get("/ws", { websocket: true }, async (socket, request) => {
    const query = request.query as { accessToken?: string };
    const ctx = await requireAuthToken(request, query.accessToken);
    const cleanup = new Set<() => void>();
    const dispose = () => {
      for (const leave of cleanup) leave();
      cleanup.clear();
    };

    socket.on("message", async (raw: Buffer) => {
      try {
        const message = subscribeMessageSchema.parse(JSON.parse(raw.toString()));
        if (message.scope === "workspace") {
          await permissions.requireWorkspaceRole(ctx, message.id, "GUEST");
          cleanup.add(realtimeHub.join(`workspace:${message.id}`, socket));
        }
        if (message.scope === "project") {
          const project = await prisma.project.findFirst({
            where: { deletedAt: null, id: message.id },
            select: { id: true, workspaceId: true },
          });
          if (!project) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Project not found.");
          await permissions.requireProjectRole(ctx, project.workspaceId, project.id, "VIEWER");
          cleanup.add(realtimeHub.join(`project:${message.id}`, socket));
        }
        if (message.scope === "task") {
          const task = await prisma.task.findFirst({
            where: { deletedAt: null, id: message.id },
            select: { id: true, workspaceId: true },
          });
          if (!task) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Task not found.");
          await permissions.requireTaskRole(ctx, task.workspaceId, task.id, "VIEWER");
          cleanup.add(realtimeHub.join(`task:${message.id}`, socket));
        }
        socket.send(JSON.stringify({ ok: true, subscribed: message }));
      } catch (error) {
        socket.send(
          JSON.stringify({
            error: {
              code: error instanceof AtlasHttpError ? error.code : "ATLAS_BAD_REQUEST",
              message: error instanceof Error ? error.message : "Invalid realtime message.",
            },
          }),
        );
      }
    });

    socket.on("close", dispose);
    socket.on("error", dispose);
  });
}
