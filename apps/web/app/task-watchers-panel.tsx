"use client";

import type { FormEvent } from "react";

import type { TaskWatcher, WorkspaceMember } from "./atlas-types";

type TaskWatchersPanelProps = {
  members: WorkspaceMember[];
  onUnwatchTask: (userId: string) => Promise<void>;
  onWatchTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  watcherStatus: string;
  watchers: TaskWatcher[];
};

export function TaskWatchersPanel({ members, onUnwatchTask, onWatchTask, watcherStatus, watchers }: TaskWatchersPanelProps) {
  const watcherUserIds = new Set(watchers.map((watcher) => watcher.userId));
  const availableMembers = members.filter((member) => !watcherUserIds.has(member.userId));

  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Followers</h3>
      <div className="grid gap-2">
        {watchers.length ? (
          watchers.map((watcher) => (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={watcher.userId}>
              <span className="min-w-0 break-words text-slate-700">{watcher.user.name + " - " + watcher.user.email}</span>
              <button
                className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                onClick={() => void onUnwatchTask(watcher.userId)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No followers</p>
        )}
      </div>
      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onWatchTask(event)}>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!availableMembers.length} name="userId" required>
          <option value="">Add follower</option>
          {availableMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user.name} - {member.user.email}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!availableMembers.length} type="submit">
          Add
        </button>
      </form>
      {watcherStatus ? <p className="text-sm text-slate-600">{watcherStatus}</p> : null}
    </section>
  );
}
