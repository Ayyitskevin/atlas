"use client";

import type { FormEvent } from "react";

import { taskStatusLabel } from "./atlas-format";
import type { Subtask } from "./atlas-types";

type TaskSubtasksPanelProps = {
  onCreateSubtask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onToggleSubtask: (subtask: Subtask) => Promise<void>;
  subtasks: Subtask[];
};

export function TaskSubtasksPanel({ onCreateSubtask, onDeleteSubtask, onToggleSubtask, subtasks }: TaskSubtasksPanelProps) {
  return (
    <section className="grid gap-2 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Subtasks</h3>
      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void onCreateSubtask(event)}>
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" placeholder="Subtask title" required />
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Add
        </button>
      </form>
      <div className="grid gap-2">
        {subtasks.map((subtask) => (
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={subtask.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={"break-words font-medium " + (subtask.status === "DONE" ? "text-slate-500 line-through" : "text-slate-900")}>{subtask.title}</p>
                <p className="mt-1 text-xs text-slate-500">{taskStatusLabel(subtask.status)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onToggleSubtask(subtask)} type="button">
                  {subtask.status === "DONE" ? "Reopen" : "Done"}
                </button>
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteSubtask(subtask.id)} type="button">
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
