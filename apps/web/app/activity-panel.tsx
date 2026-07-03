"use client";

import { formatActivityDetail, formatActivityMetadata, formatActivityTitle } from "./atlas-format";
import type { ActivityEvent, ActivityScope } from "./atlas-types";

type ActivityPanelProps = {
  activities: ActivityEvent[];
  onScopeChange: (scope: ActivityScope) => void;
  scope: ActivityScope;
  selectedProjectId: string;
  selectedTaskId: string;
  statusMessage: string;
};

export function ActivityPanel({ activities, onScopeChange, scope, selectedProjectId, selectedTaskId, statusMessage }: ActivityPanelProps) {
  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Activity</h2>
          <p className="text-sm text-slate-600">{scope}</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
          <button
            className={`px-3 py-2 font-medium ${scope === "workspace" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
            onClick={() => onScopeChange("workspace")}
            type="button"
          >
            Workspace
          </button>
          <button
            className={`border-l border-slate-300 px-3 py-2 font-medium ${scope === "project" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
            disabled={!selectedProjectId}
            onClick={() => onScopeChange("project")}
            type="button"
          >
            Project
          </button>
          <button
            className={`border-l border-slate-300 px-3 py-2 font-medium ${scope === "task" ? "bg-slate-950 text-white" : "bg-white text-slate-700"}`}
            disabled={!selectedTaskId}
            onClick={() => onScopeChange("task")}
            type="button"
          >
            Task
          </button>
        </div>
      </div>

      {statusMessage ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{statusMessage}</p> : null}

      {activities.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => <ActivityCard activity={activity} key={activity.id} />)}
        </div>
      ) : null}
    </section>
  );
}

function ActivityCard({ activity }: { activity: ActivityEvent }) {
  const metadata = formatActivityMetadata(activity);
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{formatActivityTitle(activity.eventType)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatActivityDetail(activity)}</p>
        </div>
        <time className="shrink-0 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString()}</time>
      </div>
      {metadata.length ? (
        <dl className="mt-2 grid gap-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
          {metadata.map((item) => (
            <div className="grid grid-cols-[5rem_1fr] gap-2" key={item.label}>
              <dt className="font-medium text-slate-500">{item.label}</dt>
              <dd className="min-w-0 break-words text-slate-700">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
