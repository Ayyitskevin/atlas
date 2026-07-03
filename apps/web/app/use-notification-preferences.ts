"use client";

import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, NotificationPreference } from "./atlas-types";

export function useNotificationPreferences(auth: AuthPair | null, selectedWorkspaceId: string, onError: (message: string) => void) {
  const [notificationPreference, setNotificationPreference] = useState<NotificationPreference | null>(null);
  const [notificationPreferenceStatus, setNotificationPreferenceStatus] = useState("");

  function clearNotificationPreferences() {
    setNotificationPreference(null);
    setNotificationPreferenceStatus("");
  }

  async function loadNotificationPreferences(accessToken: string, workspaceId: string) {
    try {
      const preference = await api<NotificationPreference>(
        "/workspaces/" + workspaceId + "/notification-preferences",
        {},
        accessToken,
      );
      setNotificationPreference(preference);
      setNotificationPreferenceStatus("");
    } catch (error) {
      onError(errorMessage(error));
    }
  }

  async function updateNotificationEmailPreference(emailEnabled: boolean) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      onError("");
      setNotificationPreferenceStatus("Saving notification preference...");
      const preference = await api<NotificationPreference>(
        "/workspaces/" + selectedWorkspaceId + "/notification-preferences",
        { body: JSON.stringify({ emailEnabled }), method: "PATCH" },
        auth.accessToken,
      );
      setNotificationPreference(preference);
      setNotificationPreferenceStatus("Notification preference saved.");
    } catch (error) {
      setNotificationPreferenceStatus("");
      onError(errorMessage(error));
    }
  }

  return {
    clearNotificationPreferences,
    loadNotificationPreferences,
    notificationPreference,
    notificationPreferenceStatus,
    updateNotificationEmailPreference,
  };
}
