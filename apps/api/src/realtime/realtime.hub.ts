import { randomUUID } from "node:crypto";

import type { Redis } from "ioredis";

export type RealtimeSocket = {
  readyState: number;
  send(data: string): void;
};

export type RealtimeBroadcastResult = {
  delivered: number;
  pruned: number;
  roomSize: number;
  published?: boolean;
};

export type RealtimePresenceMember = {
  joinedAt: string;
  userId: string;
  userName?: string;
};

type RedisBus = {
  duplicate(): RedisBus;
  on(event: "message", listener: (channel: string, message: string) => void): void;
  publish(channel: string, message: string): Promise<number>;
  subscribe(...channels: string[]): Promise<unknown>;
};

type BroadcastEnvelope = {
  originId: string;
  payload: unknown;
  room: string;
};

const openState = 1;
const REALTIME_CHANNEL = "atlas:realtime:broadcast";

export class RealtimeHub {
  private readonly rooms = new Map<string, Set<RealtimeSocket>>();
  private readonly presence = new Map<string, Map<string, RealtimePresenceMember>>();
  private readonly originId = randomUUID();
  private publisher: RedisBus | null = null;
  private subscriber: RedisBus | null = null;
  private started = false;

  /**
   * Wire Redis pub/sub so broadcasts reach sockets on other API instances.
   * Safe to call with null (local-only mode for unit tests).
   */
  async start(redis?: RedisBus | Redis | null): Promise<void> {
    if (this.started || !redis) {
      this.started = true;
      return;
    }
    this.publisher = redis as RedisBus;
    this.subscriber = typeof (redis as RedisBus).duplicate === "function" ? (redis as RedisBus).duplicate() : (redis as RedisBus);
    const subscriber = this.subscriber;
    await subscriber.subscribe(REALTIME_CHANNEL);
    subscriber.on("message", (channel: string, message: string) => {
      if (channel !== REALTIME_CHANNEL) return;
      this.handleRemoteMessage(message);
    });
    this.started = true;
  }

  async stop(): Promise<void> {
    this.publisher = null;
    this.subscriber = null;
    this.started = false;
  }

  join(room: string, socket: RealtimeSocket): () => void {
    const sockets = this.rooms.get(room) ?? new Set<RealtimeSocket>();
    sockets.add(socket);
    this.rooms.set(room, sockets);
    return () => this.leave(room, socket);
  }

  leave(room: string, socket: RealtimeSocket): void {
    const sockets = this.rooms.get(room);
    if (!sockets) return;
    sockets.delete(socket);
    if (!sockets.size) this.rooms.delete(room);
  }

  roomSize(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }

  setPresence(room: string, member: RealtimePresenceMember): RealtimePresenceMember[] {
    const members = this.presence.get(room) ?? new Map<string, RealtimePresenceMember>();
    members.set(member.userId, member);
    this.presence.set(room, members);
    return [...members.values()];
  }

  clearPresence(room: string, userId: string): RealtimePresenceMember[] {
    const members = this.presence.get(room);
    if (!members) return [];
    members.delete(userId);
    if (!members.size) this.presence.delete(room);
    return [...(this.presence.get(room)?.values() ?? [])];
  }

  listPresence(room: string): RealtimePresenceMember[] {
    return [...(this.presence.get(room)?.values() ?? [])];
  }

  broadcastWorkspace(workspaceId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`workspace:${workspaceId}`, payload);
  }

  broadcastProject(projectId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`project:${projectId}`, payload);
  }

  broadcastTask(taskId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`task:${taskId}`, payload);
  }

  /**
   * Local delivery only (used when a Redis message arrives, or when Redis is unavailable).
   */
  deliverLocal(room: string, payload: unknown): RealtimeBroadcastResult {
    const sockets = this.rooms.get(room);
    if (!sockets) return { delivered: 0, pruned: 0, roomSize: 0 };
    const message = JSON.stringify(payload);
    let delivered = 0;
    let pruned = 0;
    for (const socket of sockets) {
      if (socket.readyState !== openState) {
        sockets.delete(socket);
        pruned += 1;
        continue;
      }
      try {
        socket.send(message);
        delivered += 1;
      } catch {
        sockets.delete(socket);
        pruned += 1;
      }
    }
    if (!sockets.size) this.rooms.delete(room);
    return { delivered, pruned, roomSize: sockets.size };
  }

  broadcast(room: string, payload: unknown): RealtimeBroadcastResult {
    const local = this.deliverLocal(room, payload);
    let published = false;
    if (this.publisher) {
      const envelope: BroadcastEnvelope = { originId: this.originId, payload, room };
      void this.publisher.publish(REALTIME_CHANNEL, JSON.stringify(envelope)).then(
        () => undefined,
        () => undefined,
      );
      published = true;
    }
    return { ...local, published };
  }

  private handleRemoteMessage(raw: string): void {
    try {
      const envelope = JSON.parse(raw) as BroadcastEnvelope;
      if (!envelope?.room || envelope.originId === this.originId) return;
      this.deliverLocal(envelope.room, envelope.payload);
    } catch {
      // ignore malformed bus messages
    }
  }
}

export const realtimeHub = new RealtimeHub();
