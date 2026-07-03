export type RealtimeSocket = {
  readyState: number;
  send(data: string): void;
};

export type RealtimeBroadcastResult = {
  delivered: number;
  pruned: number;
  roomSize: number;
};

const openState = 1;

export class RealtimeHub {
  private readonly rooms = new Map<string, Set<RealtimeSocket>>();

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

  broadcastWorkspace(workspaceId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`workspace:${workspaceId}`, payload);
  }

  broadcastProject(projectId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`project:${projectId}`, payload);
  }

  broadcastTask(taskId: string, payload: unknown): RealtimeBroadcastResult {
    return this.broadcast(`task:${taskId}`, payload);
  }

  private broadcast(room: string, payload: unknown): RealtimeBroadcastResult {
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
}

export const realtimeHub = new RealtimeHub();
