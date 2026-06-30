"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { api, errorMessage } from "./atlas-api";
import type { AuthPair, Page, ResendWorkspaceInvitationResponse, WorkspaceInvitation, WorkspaceInvitationWithToken, WorkspaceMember, WorkspaceRole } from "./atlas-types";

export function useWorkspaceAdmin(auth: AuthPair | null, selectedWorkspaceId: string, currentUserId?: string) {
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<WorkspaceInvitation[]>([]);
  const [workspaceAdminMessage, setWorkspaceAdminMessage] = useState("");
  const [workspaceAdminToken, setWorkspaceAdminToken] = useState("");

  function clearWorkspaceAdminState() {
    setWorkspaceMembers([]);
    setWorkspaceInvitations([]);
    setWorkspaceAdminMessage("");
    setWorkspaceAdminToken("");
  }

  function canManageWorkspace(members: WorkspaceMember[] = workspaceMembers, userId = currentUserId) {
    const currentMember = members.find((member) => member.userId === userId);
    return currentMember?.role === "ADMIN" || currentMember?.role === "OWNER";
  }

  async function loadWorkspaceMembers(accessToken: string, workspaceId: string) {
    const memberPage = await api<Page<WorkspaceMember>>("/workspaces/" + workspaceId + "/members", {}, accessToken);
    setWorkspaceMembers(memberPage.items);
    return memberPage.items;
  }

  async function loadWorkspaceInvitations(
    accessToken: string,
    workspaceId: string,
    members: WorkspaceMember[] = workspaceMembers,
    userId = currentUserId,
  ) {
    if (!canManageWorkspace(members, userId)) {
      setWorkspaceInvitations([]);
      setWorkspaceAdminToken("");
      return;
    }

    const invitationPage = await api<Page<WorkspaceInvitation>>("/workspaces/" + workspaceId + "/invitations", {}, accessToken);
    setWorkspaceInvitations(invitationPage.items);
  }

  async function refreshWorkspaceAdmin() {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Refreshing workspace admin...");
      const members = await loadWorkspaceMembers(auth.accessToken, selectedWorkspaceId);
      await loadWorkspaceInvitations(auth.accessToken, selectedWorkspaceId, members);
      setWorkspaceAdminMessage("");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function inviteWorkspaceMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const form = new FormData(event.currentTarget);

    try {
      setWorkspaceAdminMessage("Creating invitation...");
      const invitation = await api<WorkspaceInvitationWithToken>(
        "/workspaces/" + selectedWorkspaceId + "/invitations",
        {
          body: JSON.stringify({ email: String(form.get("email")), role: String(form.get("role")) }),
          method: "POST",
        },
        auth.accessToken,
      );
      setWorkspaceAdminToken(invitation.acceptToken);
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Invitation created.");
      event.currentTarget.reset();
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function cancelWorkspaceInvitation(invitationId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Canceling invitation...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/invitations/" + invitationId + "/cancel",
        { method: "POST" },
        auth.accessToken,
      );
      setWorkspaceAdminToken("");
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Invitation canceled.");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function resendWorkspaceInvitation(invitationId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Resending invitation...");
      const result = await api<ResendWorkspaceInvitationResponse>(
        "/workspaces/" + selectedWorkspaceId + "/invitations/" + invitationId + "/resend",
        { method: "POST" },
        auth.accessToken,
      );
      setWorkspaceAdminToken(result.acceptToken);
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Invitation resent.");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function updateWorkspaceMemberRole(userId: string, role: Exclude<WorkspaceRole, "OWNER">) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Updating member role...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/members/" + userId,
        { body: JSON.stringify({ role }), method: "PATCH" },
        auth.accessToken,
      );
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Member role updated.");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function removeWorkspaceMember(userId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Removing member...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/members/" + userId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Member removed.");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  async function transferWorkspaceOwner(userId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setWorkspaceAdminMessage("Transferring ownership...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/owner-transfer",
        { body: JSON.stringify({ userId }), method: "POST" },
        auth.accessToken,
      );
      await refreshWorkspaceAdmin();
      setWorkspaceAdminMessage("Ownership transferred.");
    } catch (error) {
      setWorkspaceAdminMessage(errorMessage(error));
    }
  }

  return {
    cancelWorkspaceInvitation,
    clearWorkspaceAdminState,
    inviteWorkspaceMember,
    loadWorkspaceInvitations,
    loadWorkspaceMembers,
    refreshWorkspaceAdmin,
    removeWorkspaceMember,
    resendWorkspaceInvitation,
    transferWorkspaceOwner,
    updateWorkspaceMemberRole,
    workspaceAdminMessage,
    workspaceAdminToken,
    workspaceInvitations,
    workspaceMembers,
  };
}
