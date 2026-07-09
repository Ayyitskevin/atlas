"use client";

import { useMemo, useState } from "react";

import { api, errorMessage } from "../shared/atlas-api";
import type { AuthPair, Notification, Page } from "../shared/atlas-types";

type NotificationFilter = "all" | "unread";

export function useNotifications(auth: AuthPair | null, selectedWorkspaceId: string, onError: (message: string) => void) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("unread");
  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.status === "UNREAD").length,
    [notifications],
  );

  function clearNotifications() {
    setNotifications([]);
  }

  async function loadNotifications(accessToken: string, workspaceId: string, filter: NotificationFilter = notificationFilter) {
    try {
      const query = new URLSearchParams({ limit: "20" });
      if (filter === "unread") query.set("unreadOnly", "true");
      const notificationPage = await api<Page<Notification>>(
        "/workspaces/" + workspaceId + "/notifications?" + query.toString(),
        {},
        accessToken,
      );
      setNotifications(notificationPage.items);
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      onError("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/notifications/" + notificationId + "/read",
        { method: "POST" },
        auth.accessToken,
      );
      await loadNotifications(auth.accessToken, selectedWorkspaceId, notificationFilter);
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  async function markAllNotificationsRead() {
    if (!auth || !selectedWorkspaceId) return;
    try {
      onError("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/notifications/read-all",
        { method: "POST" },
        auth.accessToken,
      );
      await loadNotifications(auth.accessToken, selectedWorkspaceId, notificationFilter);
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  return {
    clearNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notificationFilter,
    notifications,
    setNotificationFilter,
    unreadCount,
  };
}
