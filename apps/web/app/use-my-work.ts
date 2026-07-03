"use client";

import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, MyWorkDueFilter, MyWorkScopeFilter, MyWorkStatusFilter, MyWorkTask, Page } from "./atlas-types";

export function useMyWork(auth: AuthPair | null, selectedWorkspaceId: string) {
  const [myWorkDueFilter, setMyWorkDueFilter] = useState<MyWorkDueFilter>("any");
  const [myWorkScopeFilter, setMyWorkScopeFilter] = useState<MyWorkScopeFilter>("assigned");
  const [myWorkStatusFilter, setMyWorkStatusFilter] = useState<MyWorkStatusFilter>("open");
  const [myWorkStatus, setMyWorkStatus] = useState("");
  const [myWorkTasks, setMyWorkTasks] = useState<MyWorkTask[]>([]);

  function clearMyWork() {
    setMyWorkStatus("");
    setMyWorkTasks([]);
  }

  async function loadMyWork(
    accessToken: string,
    workspaceId: string,
    status: MyWorkStatusFilter = myWorkStatusFilter,
    due: MyWorkDueFilter = myWorkDueFilter,
    scope: MyWorkScopeFilter = myWorkScopeFilter,
  ) {
    if (!workspaceId) {
      clearMyWork();
      return;
    }

    try {
      setMyWorkStatus("Loading my work...");
      const query = new URLSearchParams({ due, limit: "12", scope, status });
      const result = await api<Page<MyWorkTask>>("/workspaces/" + workspaceId + "/my-work?" + query.toString(), {}, accessToken);
      setMyWorkTasks(result.items);
      setMyWorkStatus(result.items.length ? "" : "No tasks match this view.");
    } catch (error) {
      setMyWorkTasks([]);
      setMyWorkStatus(errorMessage(error));
    }
  }

  async function refreshMyWork() {
    if (!auth || !selectedWorkspaceId) return;
    await loadMyWork(auth.accessToken, selectedWorkspaceId, myWorkStatusFilter, myWorkDueFilter, myWorkScopeFilter);
  }

  function changeMyWorkDueFilter(due: MyWorkDueFilter) {
    setMyWorkDueFilter(due);
    if (auth && selectedWorkspaceId) void loadMyWork(auth.accessToken, selectedWorkspaceId, myWorkStatusFilter, due, myWorkScopeFilter);
  }

  function changeMyWorkScopeFilter(scope: MyWorkScopeFilter) {
    setMyWorkScopeFilter(scope);
    if (auth && selectedWorkspaceId) void loadMyWork(auth.accessToken, selectedWorkspaceId, myWorkStatusFilter, myWorkDueFilter, scope);
  }

  function changeMyWorkStatusFilter(status: MyWorkStatusFilter) {
    setMyWorkStatusFilter(status);
    if (auth && selectedWorkspaceId) void loadMyWork(auth.accessToken, selectedWorkspaceId, status, myWorkDueFilter, myWorkScopeFilter);
  }

  return {
    changeMyWorkDueFilter,
    changeMyWorkScopeFilter,
    changeMyWorkStatusFilter,
    clearMyWork,
    loadMyWork,
    myWorkDueFilter,
    myWorkScopeFilter,
    myWorkStatus,
    myWorkStatusFilter,
    myWorkTasks,
    refreshMyWork,
  };
}
