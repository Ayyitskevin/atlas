"use client";

import { useEffect, useRef, useState } from "react";

import { websocketUrl } from "./atlas-api";
import {
  parseRealtimeMessage,
  realtimeReconnectDelay,
  realtimeSubscriptions,
  rememberRealtimeEvent,
  type RealtimeDomainEvent,
  type RealtimeStatus,
} from "./realtime-utils";

type UseRealtimeInput = {
  accessToken?: string;
  onError: (message: string) => void;
  onEvent: (event: RealtimeDomainEvent) => Promise<void> | void;
  projectId: string;
  taskId: string;
  workspaceId: string;
};

export function useRealtime({ accessToken, onError, onEvent, projectId, taskId, workspaceId }: UseRealtimeInput) {
  const [status, setStatus] = useState<RealtimeStatus>("offline");
  const [presenceNames, setPresenceNames] = useState<string[]>([]);
  const onErrorRef = useRef(onError);
  const onEventRef = useRef(onEvent);
  const recentEventIdsRef = useRef<string[]>([]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!accessToken || !workspaceId) {
      setStatus("offline");
      setPresenceNames([]);
      return;
    }

    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    let stopped = false;

    function connect() {
      if (stopped || !accessToken) return;
      setStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      socket = new WebSocket(websocketUrl());

      socket.onopen = () => {
        socket?.send(JSON.stringify({ action: "auth", accessToken }));
      };

      socket.onmessage = (event) => {
        const raw = String(event.data);
        try {
          const data = JSON.parse(raw) as {
            authenticated?: boolean;
            ok?: boolean;
            presence?: { members?: Array<{ userName?: string; userId: string }> };
            type?: string;
            members?: Array<{ userName?: string; userId: string }>;
          };
          if (data.ok && data.authenticated) {
            reconnectAttempt = 0;
            setStatus("connected");
            for (const subscription of realtimeSubscriptions({ projectId, taskId, workspaceId })) {
              socket?.send(JSON.stringify(subscription));
            }
            if (taskId) {
              socket?.send(JSON.stringify({ action: "presence", scope: "task", id: taskId, state: "join" }));
            }
            return;
          }
          if (data.type === "PresenceUpdated" || data.presence) {
            const members = data.members ?? data.presence?.members ?? [];
            setPresenceNames(members.map((member) => member.userName || member.userId).filter(Boolean));
            return;
          }
        } catch {
          // fall through to domain event parser
        }

        const message = parseRealtimeMessage(raw);
        if (message.kind === "error") {
          setStatus("error");
          onErrorRef.current(message.message);
          return;
        }
        if (message.kind !== "domain-event") return;
        if (!rememberRealtimeEvent(message.event.eventId, recentEventIdsRef.current)) return;
        void Promise.resolve(onEventRef.current(message.event)).catch((error: unknown) => {
          onErrorRef.current(error instanceof Error ? error.message : "Realtime refresh failed.");
        });
      };

      socket.onerror = () => {
        setStatus("error");
      };

      socket.onclose = () => {
        if (stopped) return;
        const delay = realtimeReconnectDelay(reconnectAttempt);
        reconnectAttempt += 1;
        setStatus("reconnecting");
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && taskId && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ action: "presence", scope: "task", id: taskId, state: "leave" }));
        } catch {
          // ignore
        }
      }
      socket?.close();
    };
  }, [accessToken, projectId, taskId, workspaceId]);

  return { presenceNames, status };
}
