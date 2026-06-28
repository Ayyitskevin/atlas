type RealtimeSocket = {
  readyState: number;
  send(data: string): void;
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

  broadcastWorkspace(workspaceId: string, payload: unknown): void {
    this.broadcast(`workspace:${workspaceId}`, payload);
  }

  broadcastProject(projectId: string, payload: unknown): void {
    this.broadcast(`project:${projectId}`, payload);
  }

  broadcastTask(taskId: string, payload: unknown): void {
    this.broadcast(`task:${taskId}`, payload);
  }

  private broadcast(room: string, payload: unknown): void {
    const sockets = this.rooms.get(room);
    if (!sockets) return;
    const message = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === openState) socket.send(message);
    }
  }
}

export const realtimeHub = new RealtimeHub();
