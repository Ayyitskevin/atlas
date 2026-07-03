"use client";

import type { FormEvent } from "react";

import type { TaskLabel, TaskLabelAssignment } from "./atlas-types";

type TaskLabelsPanelProps = {
  labelStatus: string;
  labels: TaskLabel[];
  onAssignTaskLabel: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTaskLabel: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUnassignTaskLabel: (labelId: string) => Promise<void>;
  taskLabels: TaskLabelAssignment[];
};

export function TaskLabelsPanel({
  labelStatus,
  labels,
  onAssignTaskLabel,
  onCreateTaskLabel,
  onUnassignTaskLabel,
  taskLabels,
}: TaskLabelsPanelProps) {
  const assignedLabelIds = new Set(taskLabels.map((assignment) => assignment.labelId));
  const availableLabels = labels.filter((label) => !assignedLabelIds.has(label.id));

  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Labels</h3>
      <div className="flex flex-wrap gap-2">
        {taskLabels.length ? (
          taskLabels.map((assignment) => (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700"
              key={assignment.id}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: assignment.label.color }}
              />
              <span className="min-w-0 break-words">{assignment.label.name}</span>
              <button
                className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-600"
                onClick={() => void onUnassignTaskLabel(assignment.labelId)}
                type="button"
              >
                Remove
              </button>
            </span>
          ))
        ) : (
          <p className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">No labels</p>
        )}
      </div>

      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onAssignTaskLabel(event)}>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" disabled={!availableLabels.length} name="labelId" required>
          <option value="">Add existing label</option>
          {availableLabels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!availableLabels.length} type="submit">
          Add
        </button>
      </form>

      <form className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]" onSubmit={(event) => void onCreateTaskLabel(event)}>
        <input
          aria-label="Label color"
          className="h-10 w-12 rounded-md border border-slate-300 bg-white p-1"
          defaultValue="#2563eb"
          name="color"
          type="color"
        />
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" maxLength={40} name="name" placeholder="New label" required />
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" type="submit">
          Create
        </button>
      </form>
      {labelStatus ? <p className="text-sm text-slate-600">{labelStatus}</p> : null}
    </section>
  );
}
