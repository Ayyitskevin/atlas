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

const authMessageSchema = z.object({
  action: z.literal("auth"),
  accessToken: z.string().min(1),
});

const presenceMessageSchema = z.object({
  action: z.literal("presence"),
  scope: z.enum(["task", "project"]),
  id: z.string().uuid(),
  state: z.enum(["join", "leave"]),
});

const clientMessageSchema = z.union([authMessageSchema, subscribeMessageSchema, presenceMessageSchema]);

export async function registerRealtimeRoutes(app: FastifyInstance): Promise<void> {
  const permissions = new PermissionsService(prisma);

  app.get("/ws", { websocket: true }, async (socket, request) => {
    const query = request.query as { accessToken?: string };
    const protocolToken = extractProtocolAccessToken(request.headers["sec-websocket-protocol"]);
    let accessToken = protocolToken ?? query.accessToken;
    let ctx = accessToken ? await requireAuthToken(request, accessToken).catch(() => null) : null;
    const cleanup = new Set<() => void>();
    const presenceRooms = new Set<string>();
    const dispose = () => {
      if (ctx) {
        for (const room of presenceRooms) {
          const members = realtimeHub.clearPresence(room, ctx.userId);
          realtimeHub.deliverLocal(room, {
            type: "PresenceUpdated",
            room,
            members,
          });
        }
      }
      for (const leave of cleanup) leave();
      cleanup.clear();
      presenceRooms.clear();
    };

    socket.on("message", async (raw: Buffer) => {
      try {
        const parsed = clientMessageSchema.parse(JSON.parse(raw.toString()));

        if (parsed.action === "auth") {
          accessToken = parsed.accessToken;
          ctx = await requireAuthToken(request, accessToken);
          socket.send(JSON.stringify({ ok: true, authenticated: true }));
          return;
        }

        if (!ctx) {
          throw new AtlasHttpError(401, "ATLAS_UNAUTHORIZED", "Authenticate the WebSocket before subscribing.");
        }

        if (parsed.action === "subscribe") {
          if (parsed.scope === "workspace") {
            await permissions.requireWorkspaceRole(ctx, parsed.id, "GUEST");
            cleanup.add(realtimeHub.join(`workspace:${parsed.id}`, socket));
          }
          if (parsed.scope === "project") {
            const project = await prisma.project.findFirst({
              where: { deletedAt: null, id: parsed.id },
              select: { id: true, workspaceId: true },
            });
            if (!project) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Project not found.");
            await permissions.requireProjectRole(ctx, project.workspaceId, project.id, "VIEWER");
            cleanup.add(realtimeHub.join(`project:${parsed.id}`, socket));
          }
          if (parsed.scope === "task") {
            const task = await prisma.task.findFirst({
              where: { deletedAt: null, id: parsed.id },
              select: { id: true, workspaceId: true },
            });
            if (!task) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Task not found.");
            await permissions.requireTaskRole(ctx, task.workspaceId, task.id, "VIEWER");
            cleanup.add(realtimeHub.join(`task:${parsed.id}`, socket));
          }
          socket.send(JSON.stringify({ ok: true, subscribed: parsed }));
          return;
        }

        if (parsed.action === "presence") {
          const room = `${parsed.scope}:${parsed.id}`;
          if (parsed.scope === "task") {
            const task = await prisma.task.findFirst({
              where: { deletedAt: null, id: parsed.id },
              select: { id: true, workspaceId: true },
            });
            if (!task) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Task not found.");
            await permissions.requireTaskRole(ctx, task.workspaceId, task.id, "VIEWER");
          } else {
            const project = await prisma.project.findFirst({
              where: { deletedAt: null, id: parsed.id },
              select: { id: true, workspaceId: true },
            });
            if (!project) throw new AtlasHttpError(404, "ATLAS_NOT_FOUND", "Project not found.");
            await permissions.requireProjectRole(ctx, project.workspaceId, project.id, "VIEWER");
          }

          const user = await prisma.user.findFirst({
            where: { id: ctx.userId },
            select: { id: true, name: true },
          });
          let members;
          if (parsed.state === "join") {
            presenceRooms.add(room);
            members = realtimeHub.setPresence(room, {
              joinedAt: new Date().toISOString(),
              userId: ctx.userId,
              userName: user?.name,
            });
            cleanup.add(realtimeHub.join(room, socket));
          } else {
            presenceRooms.delete(room);
            members = realtimeHub.clearPresence(room, ctx.userId);
          }
          const payload = { type: "PresenceUpdated", room, members };
          realtimeHub.broadcast(room, payload);
          socket.send(JSON.stringify({ ok: true, presence: payload }));
        }
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

    // Prefer protocol / first-message auth; query string remains as a temporary fallback for older clients.
    if (!ctx && !query.accessToken && !protocolToken) {
      socket.send(JSON.stringify({ ok: true, authRequired: true }));
    }
  });
}

function extractProtocolAccessToken(header: string | string[] | undefined): string | undefined {
  if (!header) return undefined;
  const raw = Array.isArray(header) ? header.join(",") : header;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  // Clients should send: Sec-WebSocket-Protocol: atlas, <accessToken>
  const first = parts[0];
  const second = parts[1];
  if (first === "atlas" && second) return second;
  if (parts.length === 1 && first && first !== "atlas" && first.length > 20) return first;
  return undefined;
}
