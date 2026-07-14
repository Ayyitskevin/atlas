"use client";

import { useState } from "react";

import { api, errorMessage } from "../shared/atlas-api";
import type { AuthPair, MyWorkTask, Page } from "../shared/atlas-types";

export function useWorkspaceDashboardWork(auth: AuthPair | null, selectedWorkspaceId: string) {
  const [dashboardTasks, setDashboardTasks] = useState<MyWorkTask[]>([]);
  const [dashboardWorkStatus, setDashboardWorkStatus] = useState("");

  function clearDashboardWork() {
    setDashboardTasks([]);
    setDashboardWorkStatus("");
  }

  async function loadDashboardWork(accessToken: string, workspaceId: string) {
    if (!workspaceId) {
      clearDashboardWork();
      return;
    }

    try {
      setDashboardWorkStatus("Loading dashboard work...");
      const query = new URLSearchParams({ due: "any", limit: "20", scope: "all", status: "open" });
      const result = await api<Page<MyWorkTask>>("/workspaces/" + workspaceId + "/my-work?" + query.toString(), {}, accessToken);
      setDashboardTasks(result.items);
      setDashboardWorkStatus(result.items.length ? "" : "No assigned or watched open tasks.");
    } catch (error) {
      setDashboardTasks([]);
      setDashboardWorkStatus(errorMessage(error));
    }
  }

  async function refreshDashboardWork() {
    if (!auth || !selectedWorkspaceId) return;
    await loadDashboardWork(auth.accessToken, selectedWorkspaceId);
  }

  return {
    clearDashboardWork,
    dashboardTasks,
    dashboardWorkStatus,
    loadDashboardWork,
    refreshDashboardWork,
  };
}
