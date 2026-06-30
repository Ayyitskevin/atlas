"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, Page, ProjectMember, ProjectRole } from "./atlas-types";

export function useProjectMembers(auth: AuthPair | null, selectedWorkspaceId: string, selectedProjectId: string) {
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectMembersMessage, setProjectMembersMessage] = useState("");

  function clearProjectMemberState() {
    setProjectMembers([]);
    setProjectMembersMessage("");
  }

  async function loadProjectMembers(accessToken: string, workspaceId: string, projectId: string) {
    const memberPage = await api<Page<ProjectMember>>("/workspaces/" + workspaceId + "/projects/" + projectId + "/members", {}, accessToken);
    setProjectMembers(memberPage.items);
    return memberPage.items;
  }

  async function refreshProjectMembers() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setProjectMembersMessage("Refreshing project members...");
      await loadProjectMembers(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      setProjectMembersMessage("");
    } catch (error) {
      setProjectMembers([]);
      setProjectMembersMessage(errorMessage(error));
    }
  }

  async function addProjectMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const userId = String(form.get("userId") ?? "");
    if (!userId) return;

    try {
      setProjectMembersMessage("Adding project member...");
      await api<ProjectMember>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/members",
        { body: JSON.stringify({ role: String(form.get("role")), userId }), method: "POST" },
        auth.accessToken,
      );
      await refreshProjectMembers();
      setProjectMembersMessage("Project member added.");
      formElement.reset();
    } catch (error) {
      setProjectMembersMessage(errorMessage(error));
    }
  }

  async function updateProjectMemberRole(userId: string, role: ProjectRole) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setProjectMembersMessage("Updating project member...");
      await api<ProjectMember>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/members/" + userId,
        { body: JSON.stringify({ role }), method: "PATCH" },
        auth.accessToken,
      );
      await refreshProjectMembers();
      setProjectMembersMessage("Project member updated.");
    } catch (error) {
      setProjectMembersMessage(errorMessage(error));
    }
  }

  async function removeProjectMember(userId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setProjectMembersMessage("Removing project member...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/members/" + userId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await refreshProjectMembers();
      setProjectMembersMessage("Project member removed.");
    } catch (error) {
      setProjectMembersMessage(errorMessage(error));
    }
  }

  return {
    addProjectMember,
    clearProjectMemberState,
    loadProjectMembers,
    projectMembers,
    projectMembersMessage,
    refreshProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
  };
}
