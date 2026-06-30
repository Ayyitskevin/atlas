"use client";

import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, OutboxEvent, OutboxEventDetail, OutboxEventDetailResponse, OutboxStatus, Page, ReplayOutboxEventResponse } from "./atlas-types";

export function useOutbox(auth: AuthPair | null, selectedWorkspaceId: string) {
  const [outboxEvents, setOutboxEvents] = useState<OutboxEvent[]>([]);
  const [outboxDetail, setOutboxDetail] = useState<OutboxEventDetail | null>(null);
  const [outboxEventType, setOutboxEventType] = useState("");
  const [outboxStatus, setOutboxStatus] = useState<OutboxStatus>("failed");
  const [outboxMessage, setOutboxMessage] = useState("");

  function clearOutboxState() {
    setOutboxEvents([]);
    setOutboxDetail(null);
    setOutboxMessage("");
  }

  function resetOutboxFilters() {
    setOutboxStatus("failed");
    setOutboxEventType("");
  }

  async function loadOutbox(
    accessToken: string,
    workspaceId: string,
    status: OutboxStatus = outboxStatus,
    eventType: string = outboxEventType,
  ) {
    if (!workspaceId) {
      clearOutboxState();
      return;
    }

    try {
      setOutboxMessage("Loading outbox events...");
      const query = new URLSearchParams({ limit: "10", status });
      const trimmedEventType = eventType.trim();
      if (trimmedEventType) query.set("eventType", trimmedEventType);
      const outboxPage = await api<Page<OutboxEvent>>(
        "/workspaces/" + workspaceId + "/outbox?" + query.toString(),
        {},
        accessToken,
      );
      setOutboxEvents(outboxPage.items);
      setOutboxMessage(outboxPage.items.length ? "" : "No outbox events match this filter.");
      if (outboxDetail && !outboxPage.items.some((event) => event.id === outboxDetail.id)) setOutboxDetail(null);
    } catch (error) {
      setOutboxEvents([]);
      setOutboxDetail(null);
      setOutboxMessage(errorMessage(error));
    }
  }

  async function refreshOutbox() {
    if (!auth || !selectedWorkspaceId) return;
    await loadOutbox(auth.accessToken, selectedWorkspaceId, outboxStatus, outboxEventType);
  }

  async function inspectOutboxEvent(eventId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setOutboxDetail(null);
      setOutboxMessage("Loading event detail...");
      const result = await api<OutboxEventDetailResponse>(
        "/workspaces/" + selectedWorkspaceId + "/outbox/" + eventId,
        {},
        auth.accessToken,
      );
      setOutboxDetail(result.event);
      setOutboxMessage("");
    } catch (error) {
      setOutboxDetail(null);
      setOutboxMessage(errorMessage(error));
    }
  }

  async function replayOutboxEvent(eventId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setOutboxMessage("Replaying event...");
      const result = await api<ReplayOutboxEventResponse>(
        "/workspaces/" + selectedWorkspaceId + "/outbox/" + eventId + "/replay",
        { method: "POST" },
        auth.accessToken,
      );
      setOutboxMessage(result.replayQueued ? "Replay queued." : "Replay request completed.");
      setOutboxDetail((currentDetail) =>
        currentDetail && currentDetail.id === eventId ? { ...currentDetail, ...result.event } : currentDetail,
      );
      await loadOutbox(auth.accessToken, selectedWorkspaceId, outboxStatus, outboxEventType);
    } catch (error) {
      setOutboxMessage(errorMessage(error));
    }
  }

  function changeOutboxStatus(nextStatus: OutboxStatus) {
    setOutboxStatus(nextStatus);
    if (auth && selectedWorkspaceId) void loadOutbox(auth.accessToken, selectedWorkspaceId, nextStatus, outboxEventType);
  }

  return {
    changeOutboxStatus,
    clearOutboxState,
    inspectOutboxEvent,
    loadOutbox,
    outboxDetail,
    outboxEventType,
    outboxEvents,
    outboxMessage,
    outboxStatus,
    refreshOutbox,
    replayOutboxEvent,
    resetOutboxFilters,
    setOutboxEventType,
  };
}
