import { describe, expect, it, vi } from "vitest";

import { RealtimeHub, type RealtimeSocket } from "../../src/realtime/realtime.hub.js";

const closedState = 3;
const openState = 1;

describe("RealtimeHub", () => {
  it("prunes non-open sockets while broadcasting", () => {
    const hub = new RealtimeHub();
    const openSocket = fakeSocket(openState);
    const closedSocket = fakeSocket(closedState);

    hub.join("workspace:workspace-1", openSocket);
    hub.join("workspace:workspace-1", closedSocket);

    expect(hub.roomSize("workspace:workspace-1")).toBe(2);
    expect(hub.broadcastWorkspace("workspace-1", { type: "TaskUpdated" })).toMatchObject({
      delivered: 1,
      pruned: 1,
      roomSize: 1,
    });
    expect(openSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "TaskUpdated" }));
    expect(closedSocket.send).not.toHaveBeenCalled();
    expect(hub.roomSize("workspace:workspace-1")).toBe(1);
  });

  it("continues delivery and prunes sockets when send throws", () => {
    const hub = new RealtimeHub();
    const brokenSocket = fakeSocket(openState, () => {
      throw new Error("socket closed during send");
    });
    const openSocket = fakeSocket(openState);

    hub.join("task:task-1", brokenSocket);
    hub.join("task:task-1", openSocket);

    expect(() => hub.broadcastTask("task-1", { type: "CommentCreated" })).not.toThrow();
    expect(brokenSocket.send).toHaveBeenCalledOnce();
    expect(openSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: "CommentCreated" }));
    expect(hub.roomSize("task:task-1")).toBe(1);
  });

  it("removes empty rooms when the last socket leaves", () => {
    const hub = new RealtimeHub();
    const socket = fakeSocket(openState);
    const leave = hub.join("project:project-1", socket);

    expect(hub.roomSize("project:project-1")).toBe(1);
    leave();
    expect(hub.roomSize("project:project-1")).toBe(0);
    expect(hub.broadcastProject("project-1", { type: "ProjectUpdated" })).toMatchObject({
      delivered: 0,
      pruned: 0,
      roomSize: 0,
    });
  });

  it("tracks presence members per room", () => {
    const hub = new RealtimeHub();
    hub.setPresence("task:t1", { joinedAt: "2026-07-09T00:00:00.000Z", userId: "u1", userName: "Ada" });
    hub.setPresence("task:t1", { joinedAt: "2026-07-09T00:00:01.000Z", userId: "u2", userName: "Bob" });
    expect(hub.listPresence("task:t1")).toHaveLength(2);
    expect(hub.clearPresence("task:t1", "u1")).toEqual([{ joinedAt: "2026-07-09T00:00:01.000Z", userId: "u2", userName: "Bob" }]);
  });
});

function fakeSocket(readyState: number, send?: (data: string) => void): RealtimeSocket {
  return {
    readyState,
    send: vi.fn(send),
  };
}
