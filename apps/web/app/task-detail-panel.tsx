"use client";

import type { FormEvent } from "react";

import { dateInputValue, formatBytes, taskStatusLabel } from "./atlas-format";
import type { Attachment, Comment, Section, Subtask, Task, TaskPriority, TaskStatus, WorkspaceMember } from "./atlas-types";

const taskStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];
const taskPriorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

type TaskDetailPanelProps = {
  attachmentStatus: string;
  attachments: Attachment[];
  comments: Comment[];
  members: WorkspaceMember[];
  onAssignTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCompleteTask: () => Promise<void>;
  onCreateComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateSubtask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onDeleteTask: () => Promise<void>;
  onDownloadAttachment: (attachmentId: string) => Promise<void>;
  onToggleSubtask: (subtask: Subtask) => Promise<void>;
  onUnassignTask: (userId: string) => Promise<void>;
  onUpdateComment: (commentId: string, body: string) => Promise<void>;
  onUpdateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadAttachment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  sections: Section[];
  subtasks: Subtask[];
  task?: Task;
};

export function TaskDetailPanel({
  attachmentStatus,
  attachments,
  comments,
  members,
  onAssignTask,
  onCompleteTask,
  onCreateComment,
  onCreateSubtask,
  onDeleteAttachment,
  onDeleteComment,
  onDeleteSubtask,
  onDeleteTask,
  onDownloadAttachment,
  onToggleSubtask,
  onUnassignTask,
  onUpdateComment,
  onUpdateTask,
  onUploadAttachment,
  sections,
  subtasks,
  task,
}: TaskDetailPanelProps) {
  if (!task) {
    return (
      <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Task details</h2>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">Select a task.</p>
      </aside>
    );
  }

  const assignedUserIds = new Set((task.assignees ?? []).map((assignee) => assignee.userId));
  const availableMembers = members.filter((member) => !assignedUserIds.has(member.userId));
  const assignedRows = (task.assignees ?? []).map((assignee) => ({
    assignee,
    member: members.find((member) => member.userId === assignee.userId),
  }));

  return (
    <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-sm font-semibold uppercase text-slate-500">Task details</h2>
          <p className="mt-1 break-words text-base font-semibold text-slate-950">{task.title}</p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          v{task.version}
        </span>
      </div>

      <form className="grid gap-3" key={task.id + "-details-" + task.version} onSubmit={(event) => void onUpdateTask(event)}>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Title
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={task.title} name="title" required />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Description
          <textarea
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
            defaultValue={task.description ?? ""}
            name="description"
          />
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

      <section className="grid gap-2 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-sm font-semibold uppercase text-slate-500">Attachments</h3>
          {attachmentStatus ? <p className="mt-1 text-xs text-slate-500">{attachmentStatus}</p> : null}
        </div>
        <form className="grid gap-2" onSubmit={(event) => void onUploadAttachment(event)}>
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="file" required type="file" />
          <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
            Upload
          </button>
        </form>
        <div className="grid gap-2">
          {attachments.map((attachment) => (
            <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={attachment.id}>
              <p className="break-words font-medium text-slate-900">{attachment.fileName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {attachment.mimeType} · {formatBytes(attachment.sizeBytes)}
              </p>
              <time className="mt-1 block text-xs text-slate-500">{new Date(attachment.createdAt).toLocaleString()}</time>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDownloadAttachment(attachment.id)} type="button">
                  Download
                </button>
                <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteAttachment(attachment.id)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-2 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold uppercase text-slate-500">Comments</h3>
        <form className="grid gap-2" onSubmit={(event) => void onCreateComment(event)}>
          <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" name="body" required />
          <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
            Comment
          </button>
        </form>
        {comments.map((comment) => (
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={comment.id}>
            <form className="grid gap-2" onSubmit={(event) => handleCommentSubmit(event, comment.id, onUpdateComment)}>
              <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={comment.body} name="body" required />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}{comment.editedAt ? " · edited" : ""}</time>
                <div className="flex gap-2">
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" type="submit">
                    Save
                  </button>
                  <button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700" onClick={() => void onDeleteComment(comment.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            </form>
          </article>
        ))}
      </section>
    </aside>
  );
}

function handleCommentSubmit(
  event: FormEvent<HTMLFormElement>,
  commentId: string,
  onUpdateComment: (commentId: string, body: string) => Promise<void>,
) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  void onUpdateComment(commentId, String(form.get("body") ?? ""));
}

function memberLabel(member: WorkspaceMember | undefined, fallbackUserId: string) {
  if (!member) return "Member " + fallbackUserId.slice(0, 8);
  return member.user.name + " · " + member.user.email;
}
