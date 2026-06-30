"use client";

import { formatEventType } from "./atlas-format";
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
          {activities.map((activity) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" key={activity.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{formatEventType(activity.eventType)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.entityType}
                    {activity.taskId ? " \u00b7 task" : activity.projectId ? " \u00b7 project" : ""}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString()}</time>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
