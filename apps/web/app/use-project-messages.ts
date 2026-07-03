"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { ActivityScope, AuthPair, Page, ProjectMessage } from "./atlas-types";

type UseProjectMessagesInput = {
  activityScope: ActivityScope;
  auth: AuthPair | null;
  loadActivity: (accessToken: string, workspaceId: string, scope: ActivityScope, projectId: string, taskId: string) => Promise<void>;
  selectedProjectId: string;
  selectedTaskId: string;
  selectedWorkspaceId: string;
};

export function useProjectMessages({
  activityScope,
  auth,
  loadActivity,
  selectedProjectId,
  selectedTaskId,
  selectedWorkspaceId,
}: UseProjectMessagesInput) {
  const [projectMessages, setProjectMessages] = useState<ProjectMessage[]>([]);
  const [projectMessagesStatus, setProjectMessagesStatus] = useState("");

  function clearProjectMessages() {
    setProjectMessages([]);
    setProjectMessagesStatus("");
  }

  async function loadProjectMessages(accessToken: string, workspaceId: string, projectId: string) {
    const messagePage = await api<Page<ProjectMessage>>(
      "/workspaces/" + workspaceId + "/projects/" + projectId + "/messages?limit=20",
      {},
      accessToken,
    );
    setProjectMessages(messagePage.items);
    setProjectMessagesStatus("");
  }

  async function refreshProjectMessages() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setProjectMessagesStatus("Refreshing messages...");
      await loadProjectMessages(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    } catch (error) {
      setProjectMessages([]);
      setProjectMessagesStatus(errorMessage(error));
    }
  }

  async function createProjectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setProjectMessagesStatus("Posting message...");
      await api<ProjectMessage>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/messages",
        { body: JSON.stringify({ body: String(form.get("body")), title: String(form.get("title")) }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectMessages(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
      setProjectMessagesStatus("");
      formElement.reset();
    } catch (error) {
      setProjectMessagesStatus(errorMessage(error));
    }
  }

  async function updateProjectMessage(messageId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const form = new FormData(event.currentTarget);
    try {
      setProjectMessagesStatus("Updating message...");
      await api<ProjectMessage>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/messages/" + messageId,
        { body: JSON.stringify({ body: String(form.get("body")), title: String(form.get("title")) }), method: "PATCH" },
        auth.accessToken,
      );
      await loadProjectMessages(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
      setProjectMessagesStatus("");
    } catch (error) {
      setProjectMessagesStatus(errorMessage(error));
    }
  }

  async function deleteProjectMessage(messageId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setProjectMessagesStatus("Deleting message...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/messages/" + messageId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadProjectMessages(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
      setProjectMessagesStatus("");
    } catch (error) {
      setProjectMessagesStatus(errorMessage(error));
    }
  }

  return {
    clearProjectMessages,
    createProjectMessage,
    deleteProjectMessage,
    loadProjectMessages,
    projectMessages,
    projectMessagesStatus,
    refreshProjectMessages,
    updateProjectMessage,
  };
}
