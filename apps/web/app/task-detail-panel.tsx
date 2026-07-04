"use client";

import type { FormEvent } from "react";

import type { Attachment, Comment, Section, Subtask, Task, TaskDependencies, TaskLabel, TaskLabelAssignment, TaskWatcher, WorkspaceMember } from "./atlas-types";
import { TaskAssigneesPanel } from "./task-assignees-panel";
import { TaskAttachmentsPanel } from "./task-attachments-panel";
import { TaskCommentsPanel } from "./task-comments-panel";
import { TaskDependenciesPanel } from "./task-dependencies-panel";
import { openDependencyBlockers } from "./task-dependency-utils";
import { TaskDetailFormPanel } from "./task-detail-form-panel";
import { TaskLabelsPanel } from "./task-labels-panel";
import { TaskSubtasksPanel } from "./task-subtasks-panel";
import { TaskWatchersPanel } from "./task-watchers-panel";

type TaskDetailPanelProps = {
  attachmentStatus: string;
  attachments: Attachment[];
  comments: Comment[];
  dependencies: TaskDependencies;
  dependencyStatus: string;
  labelStatus: string;
  labels: TaskLabel[];
  members: WorkspaceMember[];
  onAddDependency: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAssignTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onAssignTaskLabel: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCompleteTask: () => Promise<void>;
  onCompleteReadyBlockers: () => Promise<void>;
  onCreateComment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTaskLabel: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateSubtask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onDeleteTask: () => Promise<void>;
  onDownloadAttachment: (attachmentId: string) => Promise<void>;
  onReplaceAttachment: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onRemoveDependency: (dependencyId: string) => Promise<void>;
  onSkipRecurringTask: () => Promise<void>;
  onToggleSubtask: (subtask: Subtask) => Promise<void>;
  onUnassignTask: (userId: string) => Promise<void>;
  onUnassignTaskLabel: (labelId: string) => Promise<void>;
  onUnwatchTask: (userId: string) => Promise<void>;
  onUpdateComment: (commentId: string, body: string) => Promise<void>;
  onUpdateAttachmentDescription: (event: FormEvent<HTMLFormElement>, attachmentId: string) => Promise<void>;
  onUpdateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadAttachment: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onWatchTask: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  sections: Section[];
  subtasks: Subtask[];
  task?: Task;
  taskLabels: TaskLabelAssignment[];
  taskWatchers: TaskWatcher[];
  tasks: Task[];
  watcherStatus: string;
};

export function TaskDetailPanel({
  attachmentStatus,
  attachments,
  comments,
  dependencies,
  dependencyStatus,
  labelStatus,
  labels,
  members,
  onAddDependency,
  onAssignTask,
  onAssignTaskLabel,
  onCompleteTask,
  onCompleteReadyBlockers,
  onCreateComment,
  onCreateTaskLabel,
  onCreateSubtask,
  onDeleteAttachment,
  onDeleteComment,
  onDeleteSubtask,
  onDeleteTask,
  onDownloadAttachment,
  onReplaceAttachment,
  onRemoveDependency,
  onSkipRecurringTask,
  onToggleSubtask,
  onUnassignTask,
  onUnassignTaskLabel,
  onUnwatchTask,
  onUpdateComment,
  onUpdateAttachmentDescription,
  onUpdateTask,
  onUploadAttachment,
  onWatchTask,
  sections,
  subtasks,
  task,
  taskLabels,
  taskWatchers,
  tasks,
  watcherStatus,
}: TaskDetailPanelProps) {
  if (!task) {
    return (
      <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Task details</h2>
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">Select a task.</p>
      </aside>
    );
  }

  const openBlockerCount = openDependencyBlockers(dependencies).length;

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

      <TaskDetailFormPanel
        onCompleteTask={onCompleteTask}
        onDeleteTask={onDeleteTask}
        onSkipRecurringTask={onSkipRecurringTask}
        onUpdateTask={onUpdateTask}
        openBlockerCount={openBlockerCount}
        sections={sections}
        task={task}
      />

      <TaskAssigneesPanel members={members} onAssignTask={onAssignTask} onUnassignTask={onUnassignTask} task={task} />

      <TaskLabelsPanel
        labelStatus={labelStatus}
        labels={labels}
        onAssignTaskLabel={onAssignTaskLabel}
        onCreateTaskLabel={onCreateTaskLabel}
        onUnassignTaskLabel={onUnassignTaskLabel}
        taskLabels={taskLabels}
      />

      <TaskWatchersPanel
        members={members}
        onUnwatchTask={onUnwatchTask}
        onWatchTask={onWatchTask}
        watcherStatus={watcherStatus}
        watchers={taskWatchers}
      />

      <TaskDependenciesPanel
        dependencies={dependencies}
        dependencyStatus={dependencyStatus}
        onAddDependency={onAddDependency}
        onCompleteReadyBlockers={onCompleteReadyBlockers}
        onRemoveDependency={onRemoveDependency}
        task={task}
        tasks={tasks}
      />

      <TaskSubtasksPanel
        onCreateSubtask={onCreateSubtask}
        onDeleteSubtask={onDeleteSubtask}
        onToggleSubtask={onToggleSubtask}
        subtasks={subtasks}
      />

      <TaskAttachmentsPanel
        attachmentStatus={attachmentStatus}
        attachments={attachments}
        onDeleteAttachment={onDeleteAttachment}
        onDownloadAttachment={onDownloadAttachment}
        onReplaceAttachment={onReplaceAttachment}
        onUpdateAttachmentDescription={onUpdateAttachmentDescription}
        onUploadAttachment={onUploadAttachment}
      />

      <TaskCommentsPanel
        comments={comments}
        onCreateComment={onCreateComment}
        onDeleteComment={onDeleteComment}
        onUpdateComment={onUpdateComment}
      />
    </aside>
  );
}
