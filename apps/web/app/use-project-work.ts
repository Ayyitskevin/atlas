"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { attachmentMimeTypeForUpload, attachmentUploadValidationMessage } from "./attachment-upload-utils";
import { api, errorMessage } from "./atlas-api";
import { moveItemById, nextTaskPosition, sectionPositionPayload } from "./board-utils";
import { dependencyTaskIds, readyDependencyBlockers } from "./task-dependency-utils";
import type {
  ActivityScope,
  Attachment,
  AttachmentDownloadResponse,
  AuthPair,
  Comment,
  CreateAttachmentResponse,
  Page,
  ProjectDependencyMap,
  ProjectMember,
  Section,
  Subtask,
  Task,
  TaskDependencies,
  TaskLabel,
  TaskLabelAssignment,
  TaskPriority,
  TaskDependencyFilter,
  TaskStatus,
  TaskWatcher,
} from "./atlas-types";

const emptyTaskDependencies: TaskDependencies = { blockedBy: [], blocks: [], isBlocked: false };
const emptyProjectDependencyMap: ProjectDependencyMap = {
  criticalPathTaskIds: [],
  edges: [],
  nodes: [],
  stats: { blockedTaskCount: 0, blockingTaskCount: 0, edgeCount: 0, openEdgeCount: 0, readyBlockerCount: 0 },
};

type UseProjectWorkInput = {
  activityScope: ActivityScope;
  auth: AuthPair | null;
  loadActivity: (accessToken: string, workspaceId: string, scope: ActivityScope, projectId: string, taskId: string) => Promise<void>;
  loadProjectMembers: (accessToken: string, workspaceId: string, projectId: string) => Promise<ProjectMember[]>;
  selectedProjectId: string;
  selectedTaskId: string;
  selectedWorkspaceId: string;
  setActivityScope: (scope: ActivityScope) => void;
  setMessage: (message: string) => void;
  setSelectedTaskId: (taskId: string) => void;
};

export function useProjectWork({
  activityScope,
  auth,
  loadActivity,
  loadProjectMembers,
  selectedProjectId,
  selectedTaskId,
  selectedWorkspaceId,
  setActivityScope,
  setMessage,
  setSelectedTaskId,
}: UseProjectWorkInput) {
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectDependencyMap, setProjectDependencyMap] = useState<ProjectDependencyMap>(emptyProjectDependencyMap);
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [workspaceLabels, setWorkspaceLabels] = useState<TaskLabel[]>([]);
  const [taskLabels, setTaskLabels] = useState<TaskLabelAssignment[]>([]);
  const [taskWatchers, setTaskWatchers] = useState<TaskWatcher[]>([]);
  const [taskDependencies, setTaskDependencies] = useState<TaskDependencies>(emptyTaskDependencies);
  const [taskDependencyFilter, setTaskDependencyFilter] = useState<TaskDependencyFilter>("any");
  const [attachmentStatus, setAttachmentStatus] = useState("");
  const [labelStatus, setLabelStatus] = useState("");
  const [watcherStatus, setWatcherStatus] = useState("");
  const [dependencyStatus, setDependencyStatus] = useState("");
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId), [selectedTaskId, tasks]);

  function clearBoardState() {
    setSections([]);
    setTasks([]);
    setProjectDependencyMap(emptyProjectDependencyMap);
    setWorkspaceLabels([]);
  }

  function clearTaskDetailState() {
    setComments([]);
    setSubtasks([]);
    setAttachments([]);
    setTaskLabels([]);
    setTaskWatchers([]);
    setTaskDependencies(emptyTaskDependencies);
    setAttachmentStatus("");
    setLabelStatus("");
    setWatcherStatus("");
    setDependencyStatus("");
  }

  async function loadProjectData(accessToken: string, workspaceId: string, projectId: string, dependency: TaskDependencyFilter = taskDependencyFilter) {
    const taskQuery = new URLSearchParams({ dependency, limit: "100" });
    const [sectionPage, taskPage, dependencyMap, labelPage] = await Promise.all([
      api<Page<Section>>(`/workspaces/${workspaceId}/projects/${projectId}/sections`, {}, accessToken),
      api<Page<Task>>(`/workspaces/${workspaceId}/projects/${projectId}/tasks?${taskQuery.toString()}`, {}, accessToken),
      api<ProjectDependencyMap>(`/workspaces/${workspaceId}/projects/${projectId}/dependencies`, {}, accessToken),
      api<Page<TaskLabel>>(`/workspaces/${workspaceId}/labels`, {}, accessToken),
      loadProjectMembers(accessToken, workspaceId, projectId),
    ]);
    setSections(sectionPage.items);
    setTasks(taskPage.items);
    setProjectDependencyMap(dependencyMap);
    setWorkspaceLabels(labelPage.items);
  }

  function changeTaskDependencyFilter(dependency: TaskDependencyFilter) {
    setTaskDependencyFilter(dependency);
    if (auth && selectedWorkspaceId && selectedProjectId) {
      void loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId, dependency);
    }
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setMessage("");
      await api<Section>(
        `/workspaces/${selectedWorkspaceId}/projects/${selectedProjectId}/sections`,
        { body: JSON.stringify({ name: String(form.get("name")), position: Date.now() }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      formElement.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function renameSection(sectionId: string, name: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setMessage("");
      await api<Section>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/sections/" + sectionId,
        { body: JSON.stringify({ name }), method: "PATCH" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function deleteSection(sectionId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/sections/" + sectionId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function moveSection(sectionId: string, direction: -1 | 1) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const nextSections = moveItemById(sections, sectionId, direction);
    if (nextSections === sections) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/sections/reorder",
        { body: JSON.stringify({ sections: sectionPositionPayload(nextSections) }), method: "POST" },
        auth.accessToken,
      );
      setSections(nextSections);
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function moveTaskToSection(task: Task, sectionId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || task.sectionId === sectionId) return;
    try {
      setMessage("");
      const moved = await api<Task>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + task.id + "/move",
        {
          body: JSON.stringify({ position: nextTaskPosition(tasks, sectionId), sectionId, version: task.version }),
          method: "POST",
        },
        auth.accessToken,
      );
      replaceTask(moved);
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !sections[0]) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const sectionId = String(form.get("sectionId") || sections[0].id);
    try {
      setMessage("");
      await api<Task>(
        `/workspaces/${selectedWorkspaceId}/projects/${selectedProjectId}/tasks`,
        { body: JSON.stringify({ sectionId, title: String(form.get("title")) }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      formElement.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function chooseTask(taskId: string) {
    setSelectedTaskId(taskId);
    clearTaskDetailState();
    setActivityScope("task");
    if (!auth || !selectedWorkspaceId) return;
    await Promise.all([
      loadComments(auth.accessToken, selectedWorkspaceId, taskId),
      loadSubtasks(auth.accessToken, selectedWorkspaceId, taskId),
      loadAttachments(auth.accessToken, selectedWorkspaceId, taskId),
      loadTaskLabels(auth.accessToken, selectedWorkspaceId, taskId),
      loadTaskWatchers(auth.accessToken, selectedWorkspaceId, taskId),
      loadTaskDependencies(auth.accessToken, selectedWorkspaceId, taskId),
    ]);
  }

  async function loadComments(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const commentPage = await api<Page<Comment>>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`, {}, accessToken);
      setComments(commentPage.items);
    } catch (error) {
      setComments([]);
      setMessage(errorMessage(error));
    }
  }

  async function loadAttachments(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const attachmentPage = await api<Page<Attachment>>(
        `/workspaces/${workspaceId}/tasks/${taskId}/attachments?limit=20`,
        {},
        accessToken,
      );
      setAttachments(attachmentPage.items);
      setAttachmentStatus(attachmentPage.items.length ? "" : "No attachments yet.");
    } catch (error) {
      setAttachments([]);
      setAttachmentStatus(errorMessage(error));
    }
  }

  async function loadTaskLabels(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const labelPage = await api<Page<TaskLabelAssignment>>(
        "/workspaces/" + workspaceId + "/tasks/" + taskId + "/labels",
        {},
        accessToken,
      );
      setTaskLabels(labelPage.items);
      setLabelStatus("");
    } catch (error) {
      setTaskLabels([]);
      setLabelStatus(errorMessage(error));
    }
  }

  async function loadTaskWatchers(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const watcherPage = await api<Page<TaskWatcher>>(
        "/workspaces/" + workspaceId + "/tasks/" + taskId + "/watchers",
        {},
        accessToken,
      );
      setTaskWatchers(watcherPage.items);
      setWatcherStatus("");
    } catch (error) {
      setTaskWatchers([]);
      setWatcherStatus(errorMessage(error));
    }
  }

  async function loadTaskDependencies(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const dependencies = await api<TaskDependencies>(
        "/workspaces/" + workspaceId + "/tasks/" + taskId + "/dependencies",
        {},
        accessToken,
      );
      setTaskDependencies(dependencies);
      setDependencyStatus("");
    } catch (error) {
      setTaskDependencies(emptyTaskDependencies);
      setDependencyStatus(errorMessage(error));
    }
  }

  async function loadSubtasks(accessToken: string, workspaceId: string, taskId: string) {
    try {
      const subtaskPage = await api<Page<Subtask>>(
        "/workspaces/" + workspaceId + "/tasks/" + taskId + "/subtasks?limit=50",
        {},
        accessToken,
      );
      setSubtasks(subtaskPage.items);
    } catch (error) {
      setSubtasks([]);
      setMessage(errorMessage(error));
    }
  }

  function replaceTask(nextTask: Task | null | undefined) {
    if (!nextTask) return;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === nextTask.id
          ? {
              ...nextTask,
              dependencySummary: nextTask.dependencySummary ?? task.dependencySummary,
            }
          : task,
      ),
    );
  }

  async function updateTaskDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTask) return;
    const form = new FormData(event.currentTarget);
    let currentTask = selectedTask;

    try {
      setMessage("");
      const nextSectionId = String(form.get("sectionId") ?? currentTask.sectionId);
      if (nextSectionId && nextSectionId !== currentTask.sectionId) {
        const moved = await api<Task>(
          "/workspaces/" + selectedWorkspaceId + "/tasks/" + currentTask.id + "/move",
          {
            body: JSON.stringify({ position: Date.now(), sectionId: nextSectionId, version: currentTask.version }),
            method: "POST",
          },
          auth.accessToken,
        );
        replaceTask(moved);
        currentTask = moved;
      }

      const dueDate = String(form.get("dueDate") ?? "");
      const recurrenceFrequency = String(form.get("recurrenceFrequency") ?? "");
      const recurrenceInterval = Number(form.get("recurrenceInterval") ?? 1);
      const recurrencePaused = recurrenceFrequency ? form.get("recurrencePaused") === "true" : false;
      const updated = await api<Task>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + currentTask.id,
        {
          body: JSON.stringify({
            description: String(form.get("description") ?? ""),
            dueDate: dueDate || null,
            priority: String(form.get("priority")) as TaskPriority,
            recurrenceFrequency: recurrenceFrequency || null,
            recurrenceInterval: recurrenceFrequency ? recurrenceInterval : null,
            recurrencePaused,
            status: String(form.get("status")) as TaskStatus,
            title: String(form.get("title")),
            version: currentTask.version,
          }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      replaceTask(updated);
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, updated.id);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function skipRecurringTask() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTask) return;
    try {
      setMessage("");
      const skipped = await api<Task>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTask.id + "/skip",
        { method: "POST" },
        auth.accessToken,
      );
      replaceTask(skipped);
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, skipped.id);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function completeTask() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTask) return;
    try {
      setMessage("");
      const completed = await api<Task>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTask.id + "/complete",
        { method: "POST" },
        auth.accessToken,
      );
      replaceTask(completed);
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, completed.id);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function completeReadyBlockers() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const blockerIds = dependencyTaskIds(readyDependencyBlockers(taskDependencies));
    if (!blockerIds.length) {
      setDependencyStatus("No ready blockers to complete.");
      return;
    }

    try {
      setDependencyStatus("Completing " + blockerIds.length + " ready " + (blockerIds.length === 1 ? "blocker" : "blockers") + "...");
      for (const blockerId of blockerIds) {
        await api<Task>(
          "/workspaces/" + selectedWorkspaceId + "/tasks/" + blockerId + "/complete",
          { method: "POST" },
          auth.accessToken,
        );
      }
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadTaskDependencies(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      setDependencyStatus("Completed " + blockerIds.length + " ready " + (blockerIds.length === 1 ? "blocker." : "blockers."));
    } catch (error) {
      setDependencyStatus(errorMessage(error));
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadTaskDependencies(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    }
  }

  async function deleteTask() {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTask) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTask.id,
        { method: "DELETE" },
        auth.accessToken,
      );
      setSelectedTaskId("");
      clearTaskDetailState();
      if (activityScope === "task") setActivityScope("project");
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "project", selectedProjectId, "");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function createSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    try {
      setMessage("");
      await api<Subtask>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/subtasks",
        { body: JSON.stringify({ title: String(form.get("title")) }), method: "POST" },
        auth.accessToken,
      );
      await loadSubtasks(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function toggleSubtask(subtask: Subtask) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setMessage("");
      const updated = await api<Subtask>(
        "/workspaces/" + selectedWorkspaceId + "/subtasks/" + subtask.id,
        {
          body: JSON.stringify({ status: subtask.status === "DONE" ? "TODO" : "DONE", version: subtask.version }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      setSubtasks((currentSubtasks) => currentSubtasks.map((item) => (item.id === updated.id ? updated : item)));
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function deleteSubtask(subtaskId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/subtasks/" + subtaskId,
        { method: "DELETE" },
        auth.accessToken,
      );
      setSubtasks((currentSubtasks) => currentSubtasks.filter((subtask) => subtask.id !== subtaskId));
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function assignTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    const userId = String(form.get("userId") ?? "");
    if (!userId) return;
    try {
      setMessage("");
      await api(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/assign",
        { body: JSON.stringify({ userId }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function unassignTask(userId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/unassign",
        { body: JSON.stringify({ userId }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function createTaskLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const color = String(form.get("color") ?? "#64748b");
    if (!name) return;
    try {
      setLabelStatus("");
      const label = await api<TaskLabel>(
        "/workspaces/" + selectedWorkspaceId + "/labels",
        { body: JSON.stringify({ color, name }), method: "POST" },
        auth.accessToken,
      );
      await api<TaskLabelAssignment>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/labels/" + label.id,
        { method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadTaskLabels(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      formElement.reset();
    } catch (error) {
      setLabelStatus(errorMessage(error));
    }
  }

  async function assignTaskLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const labelId = String(form.get("labelId") ?? "");
    if (!labelId) return;
    try {
      setLabelStatus("");
      await api<TaskLabelAssignment>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/labels/" + labelId,
        { method: "POST" },
        auth.accessToken,
      );
      await loadTaskLabels(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      formElement.reset();
    } catch (error) {
      setLabelStatus(errorMessage(error));
    }
  }

  async function unassignTaskLabel(labelId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setLabelStatus("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/labels/" + labelId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadTaskLabels(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setLabelStatus(errorMessage(error));
    }
  }

  async function watchTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const userId = String(form.get("userId") ?? "");
    if (!userId) return;
    try {
      setWatcherStatus("");
      await api<TaskWatcher>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/watchers",
        { body: JSON.stringify({ userId }), method: "POST" },
        auth.accessToken,
      );
      await loadTaskWatchers(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      formElement.reset();
    } catch (error) {
      setWatcherStatus(errorMessage(error));
    }
  }

  async function unwatchTask(userId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setWatcherStatus("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/watchers/" + userId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadTaskWatchers(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setWatcherStatus(errorMessage(error));
    }
  }

  async function addTaskDependency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const blockingTaskId = String(form.get("blockingTaskId") ?? "");
    if (!blockingTaskId) return;
    try {
      setDependencyStatus("");
      await api(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/dependencies",
        { body: JSON.stringify({ blockingTaskId }), method: "POST" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadTaskDependencies(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      formElement.reset();
    } catch (error) {
      setDependencyStatus(errorMessage(error));
    }
  }

  async function removeTaskDependency(dependencyId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setDependencyStatus("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/task-dependencies/" + dependencyId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      await loadTaskDependencies(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
    } catch (error) {
      setDependencyStatus(errorMessage(error));
    }
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    try {
      setMessage("");
      await api<Comment>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + selectedTaskId + "/comments",
        { body: JSON.stringify({ body: String(form.get("body")) }), method: "POST" },
        auth.accessToken,
      );
      await loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, selectedTaskId);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function updateComment(commentId: string, body: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setMessage("");
      await api<Comment>(
        "/workspaces/" + selectedWorkspaceId + "/comments/" + commentId,
        { body: JSON.stringify({ body }), method: "PATCH" },
        auth.accessToken,
      );
      await loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function deleteComment(commentId: string) {
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    try {
      setMessage("");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/comments/" + commentId,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const description = formString(form.get("description"));
    if (!(file instanceof File)) return;
    const validationMessage = attachmentUploadValidationMessage(file);
    if (validationMessage) {
      setAttachmentStatus(validationMessage);
      return;
    }
    const mimeType = attachmentMimeTypeForUpload(file);

    try {
      setAttachmentStatus("Uploading...");
      const created = await api<CreateAttachmentResponse>(
        `/workspaces/${selectedWorkspaceId}/tasks/${selectedTaskId}/attachments`,
        {
          body: JSON.stringify({
            fileName: file.name,
            description,
            mimeType,
            sizeBytes: file.size,
          }),
          method: "POST",
        },
        auth.accessToken,
      );
      const upload = await fetch(created.upload.url, {
        body: file,
        headers: created.upload.headers,
        method: created.upload.method,
      });
      if (!upload.ok) throw new Error("Attachment upload failed.");
      await loadAttachments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
      setAttachmentStatus("");
      event.currentTarget.reset();
    } catch (error) {
      setAttachmentStatus(errorMessage(error));
    }
  }

  async function downloadAttachment(attachmentId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setAttachmentStatus("Preparing download...");
      const result = await api<AttachmentDownloadResponse>(
        `/workspaces/${selectedWorkspaceId}/attachments/${attachmentId}/download`,
        {},
        auth.accessToken,
      );
      window.open(result.download.url, "_blank", "noopener,noreferrer");
      setAttachmentStatus("");
    } catch (error) {
      setAttachmentStatus(errorMessage(error));
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!auth || !selectedWorkspaceId || !selectedTaskId) return;
    try {
      setAttachmentStatus("Deleting attachment...");
      await api<{ ok: boolean }>(
        `/workspaces/${selectedWorkspaceId}/attachments/${attachmentId}`,
        { method: "DELETE" },
        auth.accessToken,
      );
      await loadAttachments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    } catch (error) {
      setAttachmentStatus(errorMessage(error));
    }
  }

  async function updateAttachmentDescription(event: FormEvent<HTMLFormElement>, attachmentId: string) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    try {
      setAttachmentStatus("Saving note...");
      await api<Attachment>(
        `/workspaces/${selectedWorkspaceId}/attachments/${attachmentId}`,
        {
          body: JSON.stringify({ description: formString(form.get("description")) }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      await loadAttachments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
      await loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
      setAttachmentStatus("Note saved.");
    } catch (error) {
      setAttachmentStatus(errorMessage(error));
    }
  }

  return {
    addTaskDependency,
    dependencyStatus,
    loadTaskDependencies,
    removeTaskDependency,
    taskDependencies,
    assignTask,
    attachmentStatus,
    attachments,
    chooseTask,
    clearBoardState,
    clearTaskDetailState,
    comments,
    completeTask,
    completeReadyBlockers,
    changeTaskDependencyFilter,
    createComment,
    createSection,
    createSubtask,
    createTaskLabel,
    createTask,
    deleteAttachment,
    deleteComment,
    deleteSection,
    deleteSubtask,
    deleteTask,
    downloadAttachment,
    loadAttachments,
    loadComments,
    loadProjectData,
    loadSubtasks,
    loadTaskLabels,
    loadTaskWatchers,
    moveSection,
    moveTaskToSection,
    projectDependencyMap,
    renameSection,
    sections,
    selectedTask,
    skipRecurringTask,
    subtasks,
    taskLabels,
    taskDependencyFilter,
    taskWatchers,
    tasks,
    toggleSubtask,
    assignTaskLabel,
    unassignTask,
    unassignTaskLabel,
    unwatchTask,
    updateAttachmentDescription,
    updateComment,
    updateTaskDetails,
    uploadAttachment,
    watchTask,
    watcherStatus,
    labelStatus,
    workspaceLabels,
  };
}

function formString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}
