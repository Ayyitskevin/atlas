"use client";

import type { FormEvent } from "react";

import { invitationStatus, workspaceRoleLabel } from "./atlas-format";
import type { Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceRole } from "./atlas-types";

const editableRoles: Array<Exclude<WorkspaceRole, "OWNER">> = ["ADMIN", "MEMBER", "GUEST"];

type WorkspaceAdminPanelProps = {
  acceptToken: string;
  currentUserId?: string;
  invitations: WorkspaceInvitation[];
  members: WorkspaceMember[];
  onCancelInvitation: (invitationId: string) => Promise<void>;
  onInviteMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onResendInvitation: (invitationId: string) => Promise<void>;
  onTransferOwner: (userId: string) => Promise<void>;
  onUpdateMemberRole: (userId: string, role: Exclude<WorkspaceRole, "OWNER">) => Promise<void>;
  statusMessage: string;
  workspace?: Workspace;
};

export function WorkspaceAdminPanel({
  acceptToken,
  currentUserId,
  invitations,
  members,
  onCancelInvitation,
  onInviteMember,
  onRefresh,
  onRemoveMember,
  onResendInvitation,
  onTransferOwner,
  onUpdateMemberRole,
  statusMessage,
  workspace,
}: WorkspaceAdminPanelProps) {
  const currentMember = members.find((member) => member.userId === currentUserId);
  const canManage = currentMember?.role === "ADMIN" || currentMember?.role === "OWNER";
  const canTransferOwner = currentMember?.role === "OWNER";

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Workspace admin</h2>
          <p className="text-sm text-slate-600">
            {workspace ? workspace.name + " - " + (currentMember ? workspaceRoleLabel(currentMember.role) : "no membership") : "Select a workspace"}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!workspace}
          onClick={() => void onRefresh()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Members</h3>
            <span className="text-sm text-slate-600">{members.length} active</span>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {members.length ? (
              members.map((member) => {
                const isCurrentUser = member.userId === currentUserId;
                const isOwner = member.role === "OWNER";
                const canEditRole = canManage && !isOwner;
                const canRemove = canManage && !isOwner && !isCurrentUser;
                const canTransfer = canTransferOwner && !isCurrentUser && !isOwner;

                return (
                  <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={member.userId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-slate-900">{member.user.name}</p>
                        <p className="break-all text-xs text-slate-500">{member.user.email}</p>
                        <p className="mt-1 text-xs text-slate-500">Joined {member.joinedAt ? formatDateTime(member.joinedAt) : "unknown"}</p>
                      </div>
                      <span className={"shrink-0 rounded-md px-2 py-1 text-xs font-medium " + roleClass(member.role)}>
                        {workspaceRoleLabel(member.role)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canEditRole}
                        onChange={(event) => void onUpdateMemberRole(member.userId, event.target.value as Exclude<WorkspaceRole, "OWNER">)}
                        value={member.role}
                      >
                        {isOwner ? (
                          <option value="OWNER">Owner</option>
                        ) : (
                          editableRoles.map((role) => (
                            <option key={role} value={role}>
                              {workspaceRoleLabel(role)}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canTransfer}
                          onClick={() => confirmTransfer(member.user.name) && void onTransferOwner(member.userId)}
                          type="button"
                        >
                          Make owner
                        </button>
                        <button
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canRemove}
                          onClick={() => confirmRemoval(member.user.name) && void onRemoveMember(member.userId)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No members loaded.</p>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Invitations</h3>
            <span className="text-sm text-slate-600">{invitations.length} pending</span>
          </div>

          <form className="grid gap-2" onSubmit={(event) => void onInviteMember(event)}>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!workspace || !canManage}
              name="email"
              placeholder="name@example.com"
              required
              type="email"
            />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!workspace || !canManage}
                name="role"
                required
                defaultValue="MEMBER"
              >
                {editableRoles.map((role) => (
                  <option key={role} value={role}>
                    {workspaceRoleLabel(role)}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!workspace || !canManage}
                type="submit"
              >
                Invite
              </button>
            </div>
          </form>

          {!canManage && workspace ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Admin role required for invitations and member changes.</p>
          ) : null}

          {acceptToken ? (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Latest accept token</p>
              <code className="break-all rounded-md bg-slate-100 px-2 py-1 text-slate-700">{acceptToken}</code>
            </div>
          ) : null}

          <div className="grid gap-2">
            {invitations.length ? (
              invitations.map((invitation) => (
                <article className="rounded-md border border-slate-200 bg-white p-3 text-sm" key={invitation.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-medium text-slate-900">{invitation.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {workspaceRoleLabel(invitation.role)} - expires {formatDateTime(invitation.expiresAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      {invitationStatus(invitation)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canManage}
                      onClick={() => void onResendInvitation(invitation.id)}
                      type="button"
                    >
                      Resend
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canManage}
                      onClick={() => confirmCancel(invitation.email) && void onCancelInvitation(invitation.id)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">No pending invitations.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function confirmCancel(email: string) {
  return window.confirm("Cancel the invitation for " + email + "?");
}

function confirmRemoval(name: string) {
  return window.confirm("Remove " + name + " from this workspace?");
}

function confirmTransfer(name: string) {
  return window.confirm("Transfer workspace ownership to " + name + "?");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function roleClass(role: WorkspaceRole) {
  if (role === "OWNER") return "bg-slate-950 text-white";
  if (role === "ADMIN") return "bg-blue-100 text-blue-700";
  if (role === "GUEST") return "bg-slate-200 text-slate-700";
  return "bg-emerald-100 text-emerald-700";
}
