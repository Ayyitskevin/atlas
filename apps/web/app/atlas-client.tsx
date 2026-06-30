"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, clearSession, errorMessage, storeSession } from "./atlas-api";
import { ActivityPanel } from "./activity-panel";
import { BoardPanel } from "./board-panel";
import { moveItemById, nextTaskPosition, sectionPositionPayload } from "./board-utils";
import { slugify } from "./atlas-format";
import { InviteAcceptancePanel } from "./invite-acceptance-panel";
import { MyWorkPanel } from "./my-work-panel";
import { NotificationsPanel } from "./notifications-panel";
import { OutboxPanel } from "./outbox-panel";
import { ProjectMembersPanel } from "./project-members-panel";
import { ProjectPanel } from "./project-panel";
import {
  realtimeEventTouchesProject,
  realtimeEventTouchesProjectList,
  realtimeEventTouchesProjectMembers,
  realtimeEventTouchesTask,
  type RealtimeDomainEvent,
} from "./realtime-utils";
import { TaskDetailPanel } from "./task-detail-panel";
import { useActivity } from "./use-activity";
import { useMyWork } from "./use-my-work";
import { useNotifications } from "./use-notifications";
import { useOutbox } from "./use-outbox";
import { useProjectMembers } from "./use-project-members";
import { useRealtime } from "./use-realtime";
import { useWorkspaceAdmin } from "./use-workspace-admin";
import { useWorkspaceSearch } from "./use-workspace-search";
import { WorkspaceDashboardPanel } from "./workspace-dashboard-panel";
import { WorkspaceSearchPanel } from "./workspace-search-panel";
import { WorkspaceAdminPanel } from "./workspace-admin-panel";
import type {
  AcceptWorkspaceInvitationResponse,
  Attachment,
  AttachmentDownloadResponse,
  AuthPair,
  Comment,
  CreateAttachmentResponse,
  MyWorkTask,
  Page,
  Project,
  ProjectVisibility,
  Section,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
  User,
  Workspace,
} from "./atlas-types";

export function AtlasClient({
  initialInviteToken = "",
  initialMode = "login",
}: {
  initialInviteToken?: string;
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [auth, setAuth] = useState<AuthPair | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentStatus, setAttachmentStatus] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [invitationToken, setInvitationToken] = useState(initialInviteToken);
  const [invitationMessage, setInvitationMessage] = useState(initialInviteToken ? "Invitation link loaded." : "");

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId), [selectedTaskId, tasks]);

  const { activities, activityScope, activityStatus, clearActivity, loadActivity, setActivityScope } = useActivity(
    selectedProjectId,
    selectedTaskId,
  );
  const {
    changeMyWorkDueFilter,
    changeMyWorkStatusFilter,
    clearMyWork,
    loadMyWork,
    myWorkDueFilter,
    myWorkStatus,
    myWorkStatusFilter,
    myWorkTasks,
    refreshMyWork,
  } = useMyWork(auth, selectedWorkspaceId);
  const {
    clearNotifications,
    loadNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    notificationFilter,
    notifications,
    setNotificationFilter,
    unreadCount,
  } = useNotifications(auth, selectedWorkspaceId, setMessage);
  const {
    changeOutboxStatus,
    clearOutboxState,
    inspectOutboxEvent,
    loadOutbox,
    outboxDetail,
    outboxEventType,
    outboxEvents,
    outboxMessage,
    outboxStatus,
    refreshOutbox,
    replayOutboxEvent,
    resetOutboxFilters,
    setOutboxEventType,
  } = useOutbox(auth, selectedWorkspaceId);
  const {
    cancelWorkspaceInvitation,
    clearWorkspaceAdminState,
    inviteWorkspaceMember,
    loadWorkspaceInvitations,
    loadWorkspaceMembers,
    refreshWorkspaceAdmin,
    removeWorkspaceMember,
    resendWorkspaceInvitation,
    transferWorkspaceOwner,
    updateWorkspaceMemberRole,
    workspaceAdminMessage,
    workspaceAdminToken,
    workspaceInvitations,
    workspaceMembers,
  } = useWorkspaceAdmin(auth, selectedWorkspaceId, user?.id);
  const {
    addProjectMember,
    clearProjectMemberState,
    loadProjectMembers,
    projectMembers,
    projectMembersMessage,
    refreshProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
  } = useProjectMembers(auth, selectedWorkspaceId, selectedProjectId);
  const { clearSearch, openSearchResult, searchQuery, searchResults, searchStatus, searchWorkspace, setSearchQuery } =
    useWorkspaceSearch({ auth, chooseProject, chooseTask, selectedWorkspaceId, setMessage });
  const realtimeStatus = useRealtime({
    accessToken: auth?.accessToken,
    onError: setMessage,
    onEvent: handleRealtimeEvent,
    projectId: selectedProjectId,
    taskId: selectedTaskId,
    workspaceId: selectedWorkspaceId,
  });

  useEffect(() => {
    const storedAccessToken = window.localStorage.getItem("atlas.accessToken");
    const storedRefreshToken = window.localStorage.getItem("atlas.refreshToken");
    if (!storedAccessToken || !storedRefreshToken) return;
    const storedAuth = { accessToken: storedAccessToken, refreshToken: storedRefreshToken, tokenType: "Bearer" };
    setAuth(storedAuth);
    void hydrate(storedAuth);
  }, []);

  useEffect(() => {
    if (!initialInviteToken) return;
    setInvitationToken(initialInviteToken);
    setInvitationMessage("Invitation link loaded.");
  }, [initialInviteToken]);

  useEffect(() => {
    if (!auth?.accessToken || !selectedWorkspaceId) return;
    void loadNotifications(auth.accessToken, selectedWorkspaceId, notificationFilter);
  }, [auth?.accessToken, selectedWorkspaceId, notificationFilter]);

  useEffect(() => {
    if (!auth?.accessToken || !selectedWorkspaceId) return;
    void loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId);
  }, [auth?.accessToken, selectedWorkspaceId, selectedProjectId, selectedTaskId, activityScope]);

  async function handleRealtimeEvent(event: RealtimeDomainEvent) {
    if (!auth?.accessToken || !selectedWorkspaceId) return;
    const selectedProjectWasDeleted = event.eventType === "ProjectDeleted" && event.projectId === selectedProjectId;
    const selectedProjectMembershipChanged = realtimeEventTouchesProjectMembers(event, selectedProjectId);
    const refreshes: Promise<void>[] = [
      loadNotifications(auth.accessToken, selectedWorkspaceId, notificationFilter),
      loadMyWork(auth.accessToken, selectedWorkspaceId, myWorkStatusFilter, myWorkDueFilter),
    ];
    if (!selectedProjectWasDeleted && !selectedProjectMembershipChanged) {
      refreshes.push(loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId));
    }

    if (realtimeEventTouchesProjectList(event)) {
      refreshes.push(refreshProjectsForRealtime(auth.accessToken, selectedWorkspaceId));
    }

    if (realtimeEventTouchesProject(event, selectedProjectId)) {
      refreshes.push(loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId));
    }

    if (realtimeEventTouchesProjectMembers(event, selectedProjectId)) {
      refreshes.push(refreshProjectMembers());
    }

    if (realtimeEventTouchesTask(event, selectedTaskId)) {
      refreshes.push(
        Promise.all([
          loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadSubtasks(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadAttachments(auth.accessToken, selectedWorkspaceId, selectedTaskId),
        ]).then(() => undefined),
      );
    }

    await Promise.all(refreshes);
  }

  async function refreshProjectsForRealtime(accessToken: string, workspaceId: string) {
    const projectPage = await api<Page<Project>>(`/workspaces/${workspaceId}/projects`, {}, accessToken);
    setProjects(projectPage.items);

    if (selectedProjectId && !projectPage.items.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("");
      setSelectedTaskId("");
      clearBoardState();
      clearProjectMemberState();
      clearTaskDetailState();
      clearActivity();
      if (projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
      return;
    }

    if (!selectedProjectId && projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
  }

  function clearBoardState() {
    setSections([]);
    setTasks([]);
  }

  function clearProjectState() {
    setProjects([]);
    clearBoardState();
    clearProjectMemberState();
  }

  function clearTaskDetailState() {
    setComments([]);
    setSubtasks([]);
    setAttachments([]);
    setAttachmentStatus("");
  }

  async function hydrate(currentAuth: AuthPair) {
    try {
      const me = await api<{ user: User }>("/auth/me", {}, currentAuth.accessToken);
      setUser(me.user);
      const workspacePage = await api<Page<Workspace>>("/workspaces", {}, currentAuth.accessToken);
      setWorkspaces(workspacePage.items);
      if (workspacePage.items[0]) {
        await chooseWorkspace(currentAuth.accessToken, workspacePage.items[0].id, me.user.id);
      } else {
        setSelectedWorkspaceId("");
        setSelectedProjectId("");
        setSelectedTaskId("");
        clearProjectState();
        clearTaskDetailState();
        clearNotifications();
        clearMyWork();
        clearSearch();
        clearActivity();
        clearWorkspaceAdminState();
        clearProjectMemberState();
        clearOutboxState();
      }
    } catch (error) {
      clearSession();
      setMessage(errorMessage(error));
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "register"
        ? { email: String(form.get("email")), name: String(form.get("name")), password: String(form.get("password")) }
        : { email: String(form.get("email")), password: String(form.get("password")) };
    try {
      const nextAuth = await api<AuthPair>(mode === "register" ? "/auth/register" : "/auth/login", {
        body: JSON.stringify(payload),
        method: "POST",
      });
      storeSession(nextAuth);
      setAuth(nextAuth);
      await hydrate(nextAuth);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name"));
    const slug = slugify(name);
    try {
      setMessage("");
      const workspace = await api<Workspace>(
        "/workspaces",
        { body: JSON.stringify({ name, slug }), method: "POST" },
        auth.accessToken,
      );
      setWorkspaces((currentWorkspaces) => [
        workspace,
        ...currentWorkspaces.filter((currentWorkspace) => currentWorkspace.id !== workspace.id),
      ]);
      await chooseWorkspace(auth.accessToken, workspace.id);
      formElement.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function acceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) {
      setInvitationMessage("Log in or register with the invited email before accepting.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const token = String(form.get("token") ?? "").trim();
    if (!token) return;

    try {
      setInvitationMessage("Accepting invitation...");
      const result = await api<AcceptWorkspaceInvitationResponse>(
        "/workspaces/invitations/accept",
        { body: JSON.stringify({ token }), method: "POST" },
        auth.accessToken,
      );
      const workspacePage = await api<Page<Workspace>>("/workspaces", {}, auth.accessToken);
      setWorkspaces(workspacePage.items);
      setInvitationToken("");
      await chooseWorkspace(auth.accessToken, result.member.workspaceId);
      setInvitationMessage("Invitation accepted.");
    } catch (error) {
      setInvitationMessage(errorMessage(error));
    }
  }

  async function chooseWorkspace(accessToken: string, workspaceId: string, currentUserId = user?.id) {
    setSelectedWorkspaceId(workspaceId);
    setSelectedProjectId("");
    setSelectedTaskId("");
    clearProjectState();
    clearTaskDetailState();
    clearWorkspaceAdminState();
    clearProjectMemberState();
    clearOutboxState();
    clearMyWork();
    clearSearch();
    clearActivity();
    setActivityScope("project");
    try {
      await loadNotifications(accessToken, workspaceId, notificationFilter);
      const [projectPage, , members] = await Promise.all([
        api<Page<Project>>(`/workspaces/${workspaceId}/projects`, {}, accessToken),
        loadMyWork(accessToken, workspaceId, myWorkStatusFilter, myWorkDueFilter),
        loadWorkspaceMembers(accessToken, workspaceId),
      ]);
      setProjects(projectPage.items);
      try {
        await loadWorkspaceInvitations(accessToken, workspaceId, members, currentUserId);
      } catch (error) {
        setMessage(errorMessage(error));
      }
      await loadOutbox(accessToken, workspaceId, outboxStatus, outboxEventType);
      if (projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
    } catch (error) {
      clearProjectState();
      clearTaskDetailState();
      setSelectedProjectId("");
      setSelectedTaskId("");
      clearProjectMemberState();
      setMessage(errorMessage(error));
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      setMessage("");
      const project = await api<Project>(
        `/workspaces/${selectedWorkspaceId}/projects`,
        { body: JSON.stringify({ name: String(form.get("name")), visibility: "WORKSPACE" }), method: "POST" },
        auth.accessToken,
      );
      await chooseWorkspace(auth.accessToken, selectedWorkspaceId);
      await chooseProject(auth.accessToken, selectedWorkspaceId, project.id);
      formElement.reset();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const form = new FormData(event.currentTarget);
    const projectId = String(form.get("projectId") ?? "");
    if (!projectId) return;
    const description = String(form.get("description") ?? "").trim();
    try {
      setMessage("");
      const updated = await api<Project>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + projectId,
        {
          body: JSON.stringify({
            description,
            name: String(form.get("name") ?? ""),
            visibility: String(form.get("visibility")) as ProjectVisibility,
          }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      setProjects((currentProjects) => currentProjects.map((project) => (project.id === updated.id ? updated : project)));
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function archiveProject(projectId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setMessage("");
      const archived = await api<Project>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + projectId + "/archive",
        { method: "POST" },
        auth.accessToken,
      );
      setProjects((currentProjects) => currentProjects.map((project) => (project.id === archived.id ? archived : project)));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function deleteProject(projectId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setMessage("");
      await api<Project>("/workspaces/" + selectedWorkspaceId + "/projects/" + projectId, { method: "DELETE" }, auth.accessToken);
      const remainingProjects = projects.filter((project) => project.id !== projectId);
      setProjects(remainingProjects);
      if (selectedProjectId === projectId) {
        setSelectedProjectId("");
        setSelectedTaskId("");
        clearBoardState();
        clearProjectMemberState();
        clearTaskDetailState();
        clearActivity();
        if (remainingProjects[0]) await chooseProject(auth.accessToken, selectedWorkspaceId, remainingProjects[0].id);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function chooseProject(accessToken: string, workspaceId: string, projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedTaskId("");
    clearBoardState();
    clearProjectMemberState();
    clearTaskDetailState();
    clearActivity();
    if (activityScope === "task") setActivityScope("project");
    try {
      await loadProjectData(accessToken, workspaceId, projectId);
    } catch (error) {
      clearBoardState();
      clearTaskDetailState();
      setSelectedTaskId("");
      setMessage(errorMessage(error));
    }
  }

  async function loadProjectData(accessToken: string, workspaceId: string, projectId: string) {
    const [sectionPage, taskPage] = await Promise.all([
      api<Page<Section>>(`/workspaces/${workspaceId}/projects/${projectId}/sections`, {}, accessToken),
      api<Page<Task>>(`/workspaces/${workspaceId}/projects/${projectId}/tasks`, {}, accessToken),
      loadProjectMembers(accessToken, workspaceId, projectId),
    ]);
    setSections(sectionPage.items);
    setTasks(taskPage.items);
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
    ]);
  }

  async function openMyWorkTask(task: MyWorkTask) {
    if (!auth || !selectedWorkspaceId) return;
    await chooseProject(auth.accessToken, selectedWorkspaceId, task.projectId);
    await chooseTask(task.id);
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
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === nextTask.id ? nextTask : task)));
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
      const updated = await api<Task>(
        "/workspaces/" + selectedWorkspaceId + "/tasks/" + currentTask.id,
        {
          body: JSON.stringify({
            description: String(form.get("description") ?? ""),
            dueDate: dueDate || null,
            priority: String(form.get("priority")) as TaskPriority,
            status: String(form.get("status")) as TaskStatus,
            title: String(form.get("title")),
            version: currentTask.version,
          }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      replaceTask(updated);
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, updated.id);
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
      await loadActivity(auth.accessToken, selectedWorkspaceId, "task", selectedProjectId, completed.id);
    } catch (error) {
      setMessage(errorMessage(error));
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
    if (!(file instanceof File)) return;

    try {
      setAttachmentStatus("Uploading...");
      const created = await api<CreateAttachmentResponse>(
        `/workspaces/${selectedWorkspaceId}/tasks/${selectedTaskId}/attachments`,
        {
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
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

  function logout() {
    clearSession();
    setAuth(null);
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    setSections([]);
    setTasks([]);
    setComments([]);
    setSubtasks([]);
    setAttachments([]);
    setAttachmentStatus("");
    clearNotifications();
    clearMyWork();
    clearWorkspaceAdminState();
    clearOutboxState();
    clearSearch();
    clearActivity();
    setActivityScope("project");
    resetOutboxFilters();
    setSelectedWorkspaceId("");
    setSelectedProjectId("");
    setSelectedTaskId("");
  }

  if (!auth) {
    return (
      <main className="min-h-screen px-6 py-8">
        <section className="mx-auto grid w-full max-w-md gap-6 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <p className="text-sm font-medium text-slate-500">Atlas</p>
            <h1 className="text-2xl font-semibold text-slate-950">
              {mode === "register" ? "Create your account" : "Log in"}
            </h1>
          </div>
          <form className="grid gap-4" onSubmit={submitAuth}>
            {mode === "register" ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Name
                <input className="rounded-md border border-slate-300 px-3 py-2" name="name" required />
              </label>
            ) : null}
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Email
              <input className="rounded-md border border-slate-300 px-3 py-2" name="email" required type="email" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input className="rounded-md border border-slate-300 px-3 py-2" name="password" required type="password" />
            </label>
            {message ? <p className="text-sm text-red-700">{message}</p> : null}
            {invitationMessage ? <p className="text-sm text-slate-600">{invitationMessage}</p> : null}
            <button className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" type="submit">
              {mode === "register" ? "Register" : "Log in"}
            </button>
          </form>
          <button
            className="text-left text-sm font-medium text-slate-600"
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            type="button"
          >
            {mode === "register" ? "Use an existing account" : "Create an account"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{user?.email}</p>
            <h1 className="text-2xl font-semibold text-slate-950">Atlas</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-600">{realtimeStatus}</span>
            <button className="rounded-md border border-slate-300 px-3 py-2 font-medium" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </header>

        {message ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}

        <InviteAcceptancePanel
          onAcceptInvitation={acceptInvitation}
          onTokenChange={setInvitationToken}
          statusMessage={invitationMessage}
          token={invitationToken}
        />

        <WorkspaceDashboardPanel
          activities={activities}
          myWorkTasks={myWorkTasks}
          notifications={notifications}
          onChooseProject={(projectId) => (auth ? chooseProject(auth.accessToken, selectedWorkspaceId, projectId) : Promise.resolve())}
          onCreateProject={createProject}
          onCreateTask={createTask}
          onOpenTask={openMyWorkTask}
          projects={projects}
          sections={sections}
          selectedProject={selectedProject}
          tasks={tasks}
          workspace={selectedWorkspace}
          workspaceMembers={workspaceMembers}
        />

        <MyWorkPanel
          dueFilter={myWorkDueFilter}
          onDueFilterChange={changeMyWorkDueFilter}
          onOpenTask={openMyWorkTask}
          onRefresh={refreshMyWork}
          onStatusFilterChange={changeMyWorkStatusFilter}
          statusFilter={myWorkStatusFilter}
          statusMessage={myWorkStatus}
          tasks={myWorkTasks}
          workspaceSelected={Boolean(selectedWorkspaceId)}
        />

        <WorkspaceSearchPanel
          onOpenResult={openSearchResult}
          onQueryChange={setSearchQuery}
          onSearch={searchWorkspace}
          query={searchQuery}
          results={searchResults}
          statusMessage={searchStatus}
          workspace={selectedWorkspace}
          workspaceSelected={Boolean(selectedWorkspaceId)}
        />

        <NotificationsPanel
          filter={notificationFilter}
          notifications={notifications}
          onFilterChange={setNotificationFilter}
          onMarkAllRead={markAllNotificationsRead}
          onMarkRead={markNotificationRead}
          onOpenTask={chooseTask}
          tasks={tasks}
          unreadCount={unreadCount}
          workspaceSelected={Boolean(selectedWorkspaceId)}
        />

        <ActivityPanel
          activities={activities}
          onScopeChange={setActivityScope}
          scope={activityScope}
          selectedProjectId={selectedProjectId}
          selectedTaskId={selectedTaskId}
          statusMessage={activityStatus}
        />

        <WorkspaceAdminPanel
          acceptToken={workspaceAdminToken}
          currentUserId={user?.id}
          invitations={workspaceInvitations}
          members={workspaceMembers}
          onCancelInvitation={cancelWorkspaceInvitation}
          onInviteMember={inviteWorkspaceMember}
          onRefresh={refreshWorkspaceAdmin}
          onRemoveMember={removeWorkspaceMember}
          onResendInvitation={resendWorkspaceInvitation}
          onTransferOwner={transferWorkspaceOwner}
          onUpdateMemberRole={updateWorkspaceMemberRole}
          statusMessage={workspaceAdminMessage}
          workspace={selectedWorkspace}
        />

        <ProjectMembersPanel
          currentUserId={user?.id}
          members={projectMembers}
          onAddMember={addProjectMember}
          onRefresh={refreshProjectMembers}
          onRemoveMember={removeProjectMember}
          onUpdateMemberRole={updateProjectMemberRole}
          project={selectedProject}
          statusMessage={projectMembersMessage}
          workspaceMembers={workspaceMembers}
        />

        <OutboxPanel
          detail={outboxDetail}
          eventType={outboxEventType}
          events={outboxEvents}
          onEventTypeChange={setOutboxEventType}
          onInspect={inspectOutboxEvent}
          onRefresh={refreshOutbox}
          onReplay={replayOutboxEvent}
          onStatusChange={changeOutboxStatus}
          status={outboxStatus}
          statusMessage={outboxMessage}
          workspaceSelected={Boolean(selectedWorkspaceId)}
        />

        <section className="grid gap-4 lg:grid-cols-[240px_280px_minmax(0,1fr)_320px]">
          <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Workspaces</h2>
            <form className="grid gap-2" onSubmit={createWorkspace}>
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Workspace name" required />
              <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create
              </button>
            </form>
            <div className="grid gap-2">
              {workspaces.map((workspace) => (
                <button
                  className={`rounded-md px-3 py-2 text-left text-sm ${
                    workspace.id === selectedWorkspaceId ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  key={workspace.id}
                  onClick={() => auth && void chooseWorkspace(auth.accessToken, workspace.id)}
                  type="button"
                >
                  {workspace.name}
                </button>
              ))}
            </div>
          </aside>

          <ProjectPanel
            onArchiveProject={archiveProject}
            onChooseProject={(projectId) => (auth ? chooseProject(auth.accessToken, selectedWorkspaceId, projectId) : Promise.resolve())}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            onUpdateProject={updateProject}
            projects={projects}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            workspace={selectedWorkspace}
          />

          <BoardPanel
            onChooseTask={chooseTask}
            onCreateSection={createSection}
            onCreateTask={createTask}
            onDeleteSection={deleteSection}
            onMoveSection={moveSection}
            onMoveTask={moveTaskToSection}
            onRenameSection={renameSection}
            projectName={selectedProject?.name}
            sections={sections}
            selectedTaskId={selectedTaskId}
            tasks={tasks}
          />

          <TaskDetailPanel
            attachmentStatus={attachmentStatus}
            attachments={attachments}
            comments={comments}
            members={workspaceMembers}
            onAssignTask={assignTask}
            onCompleteTask={completeTask}
            onCreateComment={createComment}
            onCreateSubtask={createSubtask}
            onDeleteAttachment={deleteAttachment}
            onDeleteComment={deleteComment}
            onDeleteSubtask={deleteSubtask}
            onDeleteTask={deleteTask}
            onDownloadAttachment={downloadAttachment}
            onToggleSubtask={toggleSubtask}
            onUnassignTask={unassignTask}
            onUpdateComment={updateComment}
            onUpdateTask={updateTaskDetails}
            onUploadAttachment={uploadAttachment}
            sections={sections}
            subtasks={subtasks}
            task={selectedTask}
          />
        </section>
      </div>
    </main>
  );
}
