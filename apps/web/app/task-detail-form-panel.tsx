"use client";

import type { FormEvent } from "react";

import { dateInputValue, taskStatusLabel } from "./atlas-format";
import type { Section, Task, TaskPriority, TaskRecurrenceFrequency, TaskStatus } from "./atlas-types";

const taskStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];
const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const recurrenceFrequencies: TaskRecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];

type TaskDetailFormPanelProps = {
  onCompleteTask: () => Promise<void>;
  onDeleteTask: () => Promise<void>;
  onUpdateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  sections: Section[];
  task: Task;
};

export function TaskDetailFormPanel({ onCompleteTask, onDeleteTask, onUpdateTask, sections, task }: TaskDetailFormPanelProps) {
  return (
    <form className="grid gap-3" key={task.id + "-details-" + task.version} onSubmit={(event) => void onUpdateTask(event)}>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Title
        <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.title} name="title" required />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Description
        <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.description ?? ""} name="description" />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Status
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.status} name="status">
            {taskStatuses.map((status) => (
              <option key={status} value={status}>
                {taskStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Priority
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.priority} name="priority">
            {taskPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Due date
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={dateInputValue(task.dueDate)} name="dueDate" type="date" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Section
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.sectionId} name="sectionId">
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Repeat
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.recurrenceFrequency ?? ""} name="recurrenceFrequency">
            <option value="">None</option>
            {recurrenceFrequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Interval
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={task.recurrenceInterval ?? 1}
            max={365}
            min={1}
            name="recurrenceInterval"
            type="number"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
          Save changes
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={task.status === "DONE"}
          onClick={() => void onCompleteTask()}
          type="button"
        >
          Complete
        </button>
        <button className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700" onClick={() => void onDeleteTask()} type="button">
          Delete
        </button>
      </div>
    </form>
  );
}
