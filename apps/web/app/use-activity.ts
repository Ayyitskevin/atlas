"use client";

import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { ActivityEvent, ActivityScope, Page } from "./atlas-types";

export function useActivity(selectedProjectId: string, selectedTaskId: string) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activityScope, setActivityScope] = useState<ActivityScope>("project");
  const [activityStatus, setActivityStatus] = useState("");

  function clearActivity() {
    setActivities([]);
    setActivityStatus("");
  }

  async function loadActivity(
    accessToken: string,
    workspaceId: string,
    scope: ActivityScope = activityScope,
    projectId = selectedProjectId,
    taskId = selectedTaskId,
  ) {
    if (scope === "project" && !projectId) {
      setActivities([]);
      setActivityStatus("Select a project.");
      return;
    }
    if (scope === "task" && !taskId) {
      setActivities([]);
      setActivityStatus("Select a task.");
      return;
    }

    const path =
      scope === "workspace"
        ? "/workspaces/" + workspaceId + "/activity?limit=10"
        : scope === "project"
          ? "/workspaces/" + workspaceId + "/projects/" + projectId + "/activity?limit=10"
          : "/workspaces/" + workspaceId + "/tasks/" + taskId + "/activity?limit=10";

    try {
      const activityPage = await api<Page<ActivityEvent>>(path, {}, accessToken);
      setActivities(activityPage.items);
      setActivityStatus(activityPage.items.length ? "" : "No activity yet.");
    } catch (error) {
      setActivities([]);
      setActivityStatus(errorMessage(error));
    }
  }

  return {
    activities,
    activityScope,
    activityStatus,
    clearActivity,
    loadActivity,
    setActivityScope,
  };
}
