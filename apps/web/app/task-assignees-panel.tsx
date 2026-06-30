"use client";

import type { FormEvent } from "react";

import type { Task, WorkspaceMember } from "./atlas-types";

type TaskAssigneesPanelProps = {
  members: WorkspaceMember[];
  onAssignTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUnassignTask: (userId: string) => Promise<void>;
  task: Task;
};

export function TaskAssigneesPanel({ members, onAssignTask, onUnassignTask, task }: TaskAssigneesPanelProps) {
  const assignedUserIds = new Set((task.assignees ?? []).map((assignee) => assignee.userId));
  const availableMembers = members.filter((member) => !assignedUserIds.has(member.userId));
  const assignedRows = (task.assignees ?? []).map((assignee) => ({
    assignee,
    member: members.find((member) => member.userId === assignee.userId),
  }));

  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Assignees</h3>
      <div className="grid gap-2">
        {assignedRows.length ? (
          assignedRows.map(({ assignee, member }) => (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={assignee.userId}>
              <span className="min-w-0 break-words text-slate-700">{memberLabel(member, assignee.userId)}</span>
              <button className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onUnassignTask(assignee.userId)} type="button">
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Unassigned</p>
        )}
      </div>
      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onAssignTask(event)}>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!availableMembers.length} name="userId" required>
          <option value="">Assign member</option>
          {availableMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user.name} · {member.user.email}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!availableMembers.length} type="submit">
          Assign
        </button>
      </form>
    </section>
  );
}

function memberLabel(member: WorkspaceMember | undefined, fallbackUserId: string) {
  if (!member) return "Member " + fallbackUserId.slice(0, 8);
  return member.user.name + " · " + member.user.email;
}
