"use client";

import type { FormEvent } from "react";

import { projectRoleLabel, workspaceRoleLabel } from "./atlas-format";
import type { Project, ProjectMember, ProjectRole, WorkspaceMember } from "./atlas-types";

const editableProjectRoles: ProjectRole[] = ["PROJECT_ADMIN", "EDITOR", "COMMENTER", "VIEWER"];

type ProjectMembersPanelProps = {
  currentUserId?: string;
  members: ProjectMember[];
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onUpdateMemberRole: (userId: string, role: ProjectRole) => Promise<void>;
  project?: Project;
  statusMessage: string;
  workspaceMembers: WorkspaceMember[];
};

export function ProjectMembersPanel({
  currentUserId,
  members,
  onAddMember,
  onRefresh,
  onRemoveMember,
  onUpdateMemberRole,
  project,
  statusMessage,
  workspaceMembers,
}: ProjectMembersPanelProps) {
  const currentWorkspaceMember = workspaceMembers.find((member) => member.userId === currentUserId);
  const currentProjectMember = members.find((member) => member.userId === currentUserId);
  const canManage =
    currentWorkspaceMember?.role === "ADMIN" ||
    currentWorkspaceMember?.role === "OWNER" ||
    currentProjectMember?.role === "PROJECT_ADMIN";
  const existingProjectMemberIds = new Set(members.map((member) => member.userId));
  const availableMembers = workspaceMembers.filter((member) => !existingProjectMemberIds.has(member.userId));
  const projectAdminCount = members.filter((member) => member.role === "PROJECT_ADMIN").length;

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Project access</h2>
          <p className="text-sm text-slate-600">
            {project ? project.name + " - " + members.length + " explicit" : "Select a project"}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!project}
          onClick={() => void onRefresh()}
          type="button"
        >
          Refresh
        </button>
      </div>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid content-start gap-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {members.length ? (
              members.map((member) => {
                const isLastProjectAdmin = member.role === "PROJECT_ADMIN" && projectAdminCount <= 1;
                const canEdit = canManage && !isLastProjectAdmin;

                return (
                  <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={member.userId}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-slate-900">{member.user.name}</p>
                        <p className="break-all text-xs text-slate-500">{member.user.email}</p>
                      </div>
                      <span className={"shrink-0 rounded-md px-2 py-1 text-xs font-medium " + roleClass(member.role)}>
                        {projectRoleLabel(member.role)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <select
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canEdit}
                        onChange={(event) => void onUpdateMemberRole(member.userId, event.target.value as ProjectRole)}
                        value={member.role}
                      >
                        {editableProjectRoles.map((role) => (
                          <option key={role} value={role}>
                            {projectRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!canEdit}
                        onClick={() => confirmProjectMemberRemoval(member.user.name) && void onRemoveMember(member.userId)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">No explicit project members loaded.</p>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold uppercase text-slate-500">Add member</h3>
          <form className="grid gap-2" onSubmit={(event) => void onAddMember(event)}>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!project || !canManage || availableMembers.length === 0}
              name="userId"
              required
            >
              <option value="">Workspace member</option>
              {availableMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.name} - {workspaceRoleLabel(member.role)}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue="EDITOR"
                disabled={!project || !canManage || availableMembers.length === 0}
                name="role"
                required
              >
                {editableProjectRoles.map((role) => (
                  <option key={role} value={role}>
                    {projectRoleLabel(role)}
                  </option>
                ))}
              </select>
              <button
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!project || !canManage || availableMembers.length === 0}
                type="submit"
              >
                Add
              </button>
            </div>
          </form>

          {!canManage && project ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Project admin role required for access changes.</p>
          ) : null}
          {canManage && availableMembers.length === 0 && project ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">All loaded workspace members have explicit project access.</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function confirmProjectMemberRemoval(name: string) {
  return window.confirm("Remove " + name + " from this project?");
}

function roleClass(role: ProjectRole) {
  if (role === "PROJECT_ADMIN") return "bg-slate-950 text-white";
  if (role === "EDITOR") return "bg-emerald-100 text-emerald-700";
  if (role === "COMMENTER") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}
