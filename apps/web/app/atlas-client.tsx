"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AuthPanel, type AuthPanelMode } from "./features/auth/auth-panel";
import { authModeFromQuery, readAuthQueryTokens } from "./features/auth/auth-query";
import { api, clearSession, errorMessage, storeSession } from "./features/shared/atlas-api";
import { ActivityPanel } from "./features/workspace/activity-panel";
import { BoardPanel } from "./features/board/board-panel";
import { slugify } from "./features/shared/atlas-format";
import { InviteAcceptancePanel } from "./features/admin/invite-acceptance-panel";
import { MyWorkPanel } from "./features/workspace/my-work-panel";
import { NotificationsPanel } from "./features/notifications/notifications-panel";
import { OutboxPanel } from "./features/admin/outbox-panel";
import { ProjectDependencyMapPanel } from "./features/board/project-dependency-map-panel";
import { ProjectMembersPanel } from "./features/workspace/project-members-panel";
import { ProjectPanel } from "./features/board/project-panel";
import { ProjectTemplatesPanel } from "./features/workspace/project-templates-panel";
import {
  realtimeEventTouchesProject,
  realtimeEventTouchesProjectList,
  realtimeEventTouchesProjectMembers,
  realtimeEventTouchesProjectMessages,
  realtimeEventTouchesProjectTemplates,
  realtimeEventTouchesTask,
  type RealtimeDomainEvent,
} from "./features/shared/realtime-utils";
import { ProjectMessagesPanel } from "./features/workspace/project-messages-panel";
import { TaskDetailPanel } from "./features/task/task-detail-panel";
import { useActivity } from "./features/workspace/use-activity";
import { useMyWork } from "./features/workspace/use-my-work";
import { useNotificationPreferences } from "./features/notifications/use-notification-preferences";
import { useNotifications } from "./features/notifications/use-notifications";
import { useOutbox } from "./features/admin/use-outbox";
import { useProjectMessages } from "./features/workspace/use-project-messages";
import { useProjectMembers } from "./features/workspace/use-project-members";
import { useProjectWork } from "./features/board/use-project-work";
import { useRealtime } from "./features/shared/use-realtime";
import { useWorkspaceAdmin } from "./features/workspace/use-workspace-admin";
import { useWorkspaceDashboardWork } from "./features/workspace/use-workspace-dashboard-work";
import { useWorkspaceSearch } from "./features/workspace/use-workspace-search";
import { WorkspaceDashboardPanel } from "./features/workspace/workspace-dashboard-panel";
import { WorkspaceSearchPanel } from "./features/workspace/workspace-search-panel";
import { WorkspaceAdminPanel } from "./features/workspace/workspace-admin-panel";
import type {
  AcceptWorkspaceInvitationResponse,
  AuthPair,
  MyWorkTask,
  Page,
  Project,
  ProjectTemplate,
  ProjectTemplateDetail,
  ProjectVisibility,
  Task,
  User,
  Workspace,
} from "./features/shared/atlas-types";

export function AtlasClient({
  initialInviteToken = "",
  initialMode = "login",
  initialWorkspaceId = "",
  initialProjectId = "",
}: {
  initialInviteToken?: string;
  initialMode?: "login" | "register";
  /** Deep-link workspace id from App Router (`/w/[workspaceId]`). */
  initialWorkspaceId?: string;
  /** Deep-link project id from App Router (`/w/.../projects/[projectId]`). */
  initialProjectId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryTokens = useMemo(
    () =>
      readAuthQueryTokens(
        searchParams?.toString()
          ? "?" + searchParams.toString()
          : typeof window !== "undefined"
            ? window.location.search
            : "",
      ),
    [searchParams],
  );
  const [mode, setMode] = useState<AuthPanelMode>(initialMode === "register" ? "register" : "login");
  const [verifyToken, setVerifyToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [authStatusMessage, setAuthStatusMessage] = useState("");

  useEffect(() => {
    setVerifyToken(queryTokens.verifyToken);
    setResetToken(queryTokens.resetToken);
    if (initialMode === "register") setMode("register");
    else setMode(authModeFromQuery(queryTokens));
  }, [initialMode, queryTokens]);
  const [auth, setAuth] = useState<AuthPair | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedProjectTemplate, setSelectedProjectTemplate] = useState<ProjectTemplateDetail | null>(null);
  const [projectTemplatesStatus, setProjectTemplatesStatus] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [invitationToken, setInvitationToken] = useState(initialInviteToken);
  const [invitationMessage, setInvitationMessage] = useState(initialInviteToken ? "Invitation link loaded." : "");
  const [urlHydrated, setUrlHydrated] = useState(!initialWorkspaceId);
  const [shellView, setShellView] = useState<"home" | "board" | "inbox" | "admin">(
    initialProjectId ? "board" : "home",
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const { activities, activityScope, activityStatus, clearActivity, loadActivity, setActivityScope } = useActivity(
    selectedProjectId,
    selectedTaskId,
  );
  const {
    changeMyWorkDependencyFilter,
    changeMyWorkDueFilter,
    changeMyWorkScopeFilter,
    changeMyWorkStatusFilter,
    clearMyWork,
    loadMyWork,
    myWorkDependencyFilter,
    myWorkDueFilter,
    myWorkScopeFilter,
    myWorkStatus,
    myWorkStatusFilter,
    myWorkTasks,
    refreshMyWork,
  } = useMyWork(auth, selectedWorkspaceId);
  const {
    clearDashboardWork,
    dashboardTasks,
    dashboardWorkStatus,
    loadDashboardWork,
  } = useWorkspaceDashboardWork(auth, selectedWorkspaceId);
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
    clearNotificationPreferences,
    loadNotificationPreferences,
    notificationPreference,
    notificationPreferenceStatus,
    updateNotificationEmailPreference,
  } = useNotificationPreferences(auth, selectedWorkspaceId, setMessage);
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
  const {
    clearProjectMessages,
    createProjectMessage,
    deleteProjectMessage,
    loadProjectMessages,
    pinProjectMessage,
    projectMessages,
    projectMessagesStatus,
    refreshProjectMessages,
    unpinProjectMessage,
    updateProjectMessage,
  } = useProjectMessages({
    activityScope,
    auth,
    loadActivity,
    selectedProjectId,
    selectedTaskId,
    selectedWorkspaceId,
  });
  const {
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
    completeTasksByIds,
    completeReadyBlockers,
    changeTaskDependencyFilter,
    createAttachmentComment,
    createComment,
    createSection,
    createSubtask,
    createTaskLabel,
    createTask,
    deleteAttachment,
    deleteAttachmentComment,
    deleteComment,
    deleteSection,
    deleteSubtask,
    deleteTask,
    downloadAttachment,
    loadAttachments,
    replaceAttachment,
    loadComments,
    loadProjectData,
    loadSubtasks,
    loadTaskLabels,
    loadTaskWatchers,
    labelStatus,
    moveSection,
    moveTaskToSection,
    moveTasksByIds,
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
    updateAttachmentComment,
    updateAttachmentDescription,
    updateComment,
    updateTaskDetails,
    uploadAttachment,
    watchTask,
    watcherStatus,
    workspaceLabels,
  } = useProjectWork({
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
  });
  const { clearSearch, hasMoreSearchResults, loadMoreSearchResults, openSearchResult, searchQuery, searchResults, searchStatus, searchWorkspace, setSearchQuery } =
    useWorkspaceSearch({ auth, chooseProject, chooseTask, selectedWorkspaceId, setMessage });
  const { presenceNames, status: realtimeStatus } = useRealtime({
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
    void loadNotificationPreferences(auth.accessToken, selectedWorkspaceId);
  }, [auth?.accessToken, selectedWorkspaceId]);

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
      loadDashboardWork(auth.accessToken, selectedWorkspaceId),
      loadMyWork(auth.accessToken, selectedWorkspaceId, myWorkStatusFilter, myWorkDueFilter, myWorkScopeFilter, myWorkDependencyFilter),
    ];
    if (!selectedProjectWasDeleted && !selectedProjectMembershipChanged) {
      refreshes.push(loadActivity(auth.accessToken, selectedWorkspaceId, activityScope, selectedProjectId, selectedTaskId));
    }

    if (realtimeEventTouchesProjectList(event)) {
      refreshes.push(refreshProjectsForRealtime(auth.accessToken, selectedWorkspaceId));
    }

    if (realtimeEventTouchesProjectTemplates(event)) {
      refreshes.push(loadProjectTemplates(auth.accessToken, selectedWorkspaceId));
      if (selectedProjectTemplate) {
        refreshes.push(loadProjectTemplateDetail(auth.accessToken, selectedWorkspaceId, selectedProjectTemplate.id));
      }
    }

    if (realtimeEventTouchesProject(event, selectedProjectId)) {
      refreshes.push(loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId));
    }

    if (realtimeEventTouchesProjectMembers(event, selectedProjectId)) {
      refreshes.push(refreshProjectMembers());
    }

    if (realtimeEventTouchesProjectMessages(event, selectedProjectId)) {
      refreshes.push(loadProjectMessages(auth.accessToken, selectedWorkspaceId, selectedProjectId));
    }

    if (realtimeEventTouchesTask(event, selectedTaskId)) {
      refreshes.push(
        Promise.all([
          loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadSubtasks(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadAttachments(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadTaskLabels(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadTaskWatchers(auth.accessToken, selectedWorkspaceId, selectedTaskId),
          loadTaskDependencies(auth.accessToken, selectedWorkspaceId, selectedTaskId),
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
      clearProjectMessages();
      clearTaskDetailState();
      clearActivity();
      if (projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
      return;
    }

    if (!selectedProjectId && projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
  }

  function clearProjectState() {
    setProjects([]);
    clearBoardState();
    clearProjectMemberState();
    clearProjectMessages();
  }

  function clearProjectTemplates() {
    setProjectTemplates([]);
    setSelectedProjectTemplate(null);
    setProjectTemplatesStatus("");
  }

  async function hydrate(currentAuth: AuthPair) {
    try {
      const me = await api<{ user: User }>("/auth/me", {}, currentAuth.accessToken);
      setUser(me.user);
      const workspacePage = await api<Page<Workspace>>("/workspaces", {}, currentAuth.accessToken);
      setWorkspaces(workspacePage.items);
      const deepLinkWorkspaceId =
        initialWorkspaceId && workspacePage.items.some((workspace) => workspace.id === initialWorkspaceId)
          ? initialWorkspaceId
          : workspacePage.items[0]?.id;
      if (deepLinkWorkspaceId) {
        await chooseWorkspace(currentAuth.accessToken, deepLinkWorkspaceId, me.user.id, {
          preferredProjectId: initialProjectId || undefined,
        });
      } else {
        setSelectedWorkspaceId("");
        setSelectedProjectId("");
        setSelectedTaskId("");
        clearProjectState();
        clearTaskDetailState();
        clearNotifications();
        clearNotificationPreferences();
        clearMyWork();
        clearSearch();
        clearActivity();
        clearWorkspaceAdminState();
        clearProjectMemberState();
        clearProjectMessages();
        clearOutboxState();
        clearDashboardWork();
        clearProjectTemplates();
      }
      setUrlHydrated(true);
    } catch (error) {
      clearSession();
      setMessage(errorMessage(error));
      setUrlHydrated(true);
    }
  }

  // Keep shareable deep-link URLs in sync without remounting via App Router navigation.
  useEffect(() => {
    if (!urlHydrated || !auth) return;
    if (pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/invite")) return;

    let target = "/";
    if (selectedWorkspaceId && selectedProjectId) {
      target = `/w/${selectedWorkspaceId}/projects/${selectedProjectId}`;
    } else if (selectedWorkspaceId) {
      target = `/w/${selectedWorkspaceId}`;
    }

    if (window.location.pathname !== target) {
      window.history.replaceState(window.history.state, "", target);
    }
  }, [auth, pathname, selectedProjectId, selectedWorkspaceId, urlHydrated]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "register"
        ? { email: String(form.get("email")), name: String(form.get("name")), password: String(form.get("password")) }
        : { email: String(form.get("email")), password: String(form.get("password")) };
    try {
      setAuthStatusMessage(mode === "register" ? "Creating account..." : "Signing in...");
      const nextAuth = await api<AuthPair>(mode === "register" ? "/auth/register" : "/auth/login", {
        body: JSON.stringify(payload),
        method: "POST",
      });
      storeSession(nextAuth);
      setAuth(nextAuth);
      await hydrate(nextAuth);
      setMessage("");
      setAuthStatusMessage(mode === "register" ? "Account created. Check your email to verify." : "");
    } catch (error) {
      setMessage(errorMessage(error));
      setAuthStatusMessage("");
    }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setMessage("");
      setAuthStatusMessage("Sending reset email...");
      await api<{ ok: boolean }>("/auth/password/request-reset", {
        body: JSON.stringify({ email: String(form.get("email")) }),
        method: "POST",
      });
      setAuthStatusMessage("If that email exists, a reset link was sent (or stubbed with EMAIL_PROVIDER=noop).");
      setMode("login");
    } catch (error) {
      setMessage(errorMessage(error));
      setAuthStatusMessage("");
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setMessage("");
      setAuthStatusMessage("Updating password...");
      await api<{ ok: boolean }>("/auth/password/reset", {
        body: JSON.stringify({ password: String(form.get("password")), token: String(form.get("token")) }),
        method: "POST",
      });
      setAuthStatusMessage("Password updated. Log in with your new password.");
      setResetToken("");
      setMode("login");
    } catch (error) {
      setMessage(errorMessage(error));
      setAuthStatusMessage("");
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setMessage("");
      setAuthStatusMessage("Verifying email...");
      await api<{ ok: boolean }>("/auth/email/verify", {
        body: JSON.stringify({ token: String(form.get("token")) }),
        method: "POST",
      });
      setAuthStatusMessage("Email verified. You can log in.");
      setVerifyToken("");
      if (window.location.search.includes("verifyToken=")) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setAuthStatusMessage("");
    }
  }

  async function resendEmailVerification() {
    if (!auth) return;
    try {
      setMessage("");
      const result = await api<{ alreadyVerified?: boolean; ok: boolean }>(
        "/auth/email/request-verification",
        { method: "POST" },
        auth.accessToken,
      );
      setMessage(result.alreadyVerified ? "Email is already verified." : "Verification email sent (or stubbed with EMAIL_PROVIDER=noop).");
      const me = await api<{ user: User }>("/auth/me", {}, auth.accessToken);
      setUser(me.user);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function openNotificationTask(taskId: string, notificationId?: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setMessage("");
      setShellView("board");
      const task = await api<Task>("/workspaces/" + selectedWorkspaceId + "/tasks/" + taskId, {}, auth.accessToken);
      if (task.projectId !== selectedProjectId) {
        await chooseProject(auth.accessToken, selectedWorkspaceId, task.projectId);
      }
      await chooseTask(task.id);
      if (notificationId) await markNotificationRead(notificationId);
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

  async function chooseWorkspace(
    accessToken: string,
    workspaceId: string,
    currentUserId = user?.id,
    options?: { preferredProjectId?: string },
  ) {
    setSelectedWorkspaceId(workspaceId);
    setSelectedProjectId("");
    setSelectedTaskId("");
    clearProjectState();
    clearTaskDetailState();
    clearWorkspaceAdminState();
    clearProjectMemberState();
    clearProjectMessages();
    clearProjectTemplates();
    clearOutboxState();
    clearDashboardWork();
    clearMyWork();
    clearNotificationPreferences();
    clearSearch();
    clearActivity();
    setActivityScope("project");
    try {
      await loadNotifications(accessToken, workspaceId, notificationFilter);
      const [projectPage, , , , , members] = await Promise.all([
        api<Page<Project>>(`/workspaces/${workspaceId}/projects`, {}, accessToken),
        loadProjectTemplates(accessToken, workspaceId),
        loadDashboardWork(accessToken, workspaceId),
        loadMyWork(accessToken, workspaceId, myWorkStatusFilter, myWorkDueFilter, myWorkScopeFilter, myWorkDependencyFilter),
        loadNotificationPreferences(accessToken, workspaceId),
        loadWorkspaceMembers(accessToken, workspaceId),
      ]);
      setProjects(projectPage.items);
      try {
        await loadWorkspaceInvitations(accessToken, workspaceId, members, currentUserId);
      } catch (error) {
        setMessage(errorMessage(error));
      }
      await loadOutbox(accessToken, workspaceId, outboxStatus, outboxEventType);
      const preferred =
        options?.preferredProjectId && projectPage.items.some((project) => project.id === options.preferredProjectId)
          ? options.preferredProjectId
          : projectPage.items[0]?.id;
      if (preferred) await chooseProject(accessToken, workspaceId, preferred);
    } catch (error) {
      clearProjectState();
      clearTaskDetailState();
      setSelectedProjectId("");
      setSelectedTaskId("");
      clearProjectMemberState();
      clearProjectTemplates();
      setMessage(errorMessage(error));
    }
  }

  async function loadProjectTemplates(accessToken: string, workspaceId: string) {
    const templatePage = await api<{ items: ProjectTemplate[] }>(`/workspaces/${workspaceId}/project-templates`, {}, accessToken);
    setProjectTemplates(templatePage.items);
    setProjectTemplatesStatus("");
  }

  async function loadProjectTemplateDetail(accessToken: string, workspaceId: string, templateId: string) {
    const template = await api<ProjectTemplateDetail>("/workspaces/" + workspaceId + "/project-templates/" + templateId, {}, accessToken);
    setSelectedProjectTemplate(template);
  }

  async function refreshProjectTemplates() {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setProjectTemplatesStatus("Refreshing templates...");
      await loadProjectTemplates(auth.accessToken, selectedWorkspaceId);
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
    }
  }

  async function previewProjectTemplate(templateId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setProjectTemplatesStatus("Loading template...");
      await loadProjectTemplateDetail(auth.accessToken, selectedWorkspaceId, templateId);
      setProjectTemplatesStatus("");
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
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

  async function saveProjectTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    try {
      setProjectTemplatesStatus("Saving template...");
      await api<ProjectTemplate>(
        "/workspaces/" + selectedWorkspaceId + "/projects/" + selectedProjectId + "/template",
        {
          body: JSON.stringify({
            ...(description ? { description } : {}),
            ...(name ? { name } : {}),
          }),
          method: "POST",
        },
        auth.accessToken,
      );
      await loadProjectTemplates(auth.accessToken, selectedWorkspaceId);
      formElement.reset();
      setProjectTemplatesStatus("");
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
    }
  }

  async function createProjectFromTemplate(templateId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const dueDateAnchor = String(form.get("dueDateAnchor") ?? "");
    if (!name) return;
    try {
      setProjectTemplatesStatus("Creating project...");
      const project = await api<Project>(
        "/workspaces/" + selectedWorkspaceId + "/project-templates/" + templateId + "/projects",
        {
          body: JSON.stringify({
            ...(dueDateAnchor ? { dueDateAnchor } : {}),
            name,
            visibility: String(form.get("visibility")) as ProjectVisibility,
          }),
          method: "POST",
        },
        auth.accessToken,
      );
      setProjects((currentProjects) => [project, ...currentProjects.filter((currentProject) => currentProject.id !== project.id)]);
      await chooseProject(auth.accessToken, selectedWorkspaceId, project.id);
      setProjectTemplatesStatus("");
      formElement.reset();
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
    }
  }

  async function updateProjectTemplate(templateId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    if (!name) return;
    try {
      setProjectTemplatesStatus("Saving template...");
      const template = await api<ProjectTemplate>(
        "/workspaces/" + selectedWorkspaceId + "/project-templates/" + templateId,
        {
          body: JSON.stringify({
            description: description ? description : null,
            name,
          }),
          method: "PATCH",
        },
        auth.accessToken,
      );
      setProjectTemplates((currentTemplates) =>
        currentTemplates.map((currentTemplate) => (currentTemplate.id === template.id ? template : currentTemplate)),
      );
      await loadProjectTemplateDetail(auth.accessToken, selectedWorkspaceId, templateId);
      setProjectTemplatesStatus("");
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
    }
  }

  async function deleteProjectTemplate(templateId: string) {
    if (!auth || !selectedWorkspaceId) return;
    try {
      setProjectTemplatesStatus("Deleting template...");
      await api<{ ok: boolean }>(
        "/workspaces/" + selectedWorkspaceId + "/project-templates/" + templateId,
        { method: "DELETE" },
        auth.accessToken,
      );
      setProjectTemplates((currentTemplates) => currentTemplates.filter((template) => template.id !== templateId));
      if (selectedProjectTemplate?.id === templateId) setSelectedProjectTemplate(null);
      setProjectTemplatesStatus("");
    } catch (error) {
      setProjectTemplatesStatus(errorMessage(error));
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
        clearProjectMessages();
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
    setShellView("board");
    setSelectedTaskId("");
    clearBoardState();
    clearProjectMemberState();
    clearProjectMessages();
    clearTaskDetailState();
    clearActivity();
    if (activityScope === "task") setActivityScope("project");
    try {
      await Promise.all([
        loadProjectData(accessToken, workspaceId, projectId),
        loadProjectMessages(accessToken, workspaceId, projectId),
      ]);
    } catch (error) {
      clearBoardState();
      clearProjectMessages();
      clearTaskDetailState();
      setSelectedTaskId("");
      setMessage(errorMessage(error));
    }
  }

  async function openMyWorkTask(task: MyWorkTask) {
    if (!auth || !selectedWorkspaceId) return;
    await chooseProject(auth.accessToken, selectedWorkspaceId, task.projectId);
    await chooseTask(task.id);
  }

  async function manageSessions() {
    if (!auth) return;
    try {
      const result = await api<{ items: Array<{ current: boolean; id: string; ipAddress?: string | null; userAgent?: string | null; createdAt: string }> }>(
        "/auth/sessions",
        {},
        auth.accessToken,
      );
      const summary = result.items
        .map((session) => (session.current ? "current" : "other") + " · " + (session.ipAddress ?? "unknown ip") + " · " + new Date(session.createdAt).toLocaleString())
        .join("\n");
      const revokeOthers = window.confirm((summary || "No active sessions.") + "\n\nRevoke all other sessions?");
      if (!revokeOthers) return;
      const revoked = await api<{ revokedCount: number }>("/auth/sessions/revoke-other", { method: "POST" }, auth.accessToken);
      setMessage("Revoked " + revoked.revokedCount + " other session(s).");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function logout() {
    clearSession();
    setAuth(null);
    setUser(null);
    setWorkspaces([]);
    setProjects([]);
    clearBoardState();
    clearTaskDetailState();
    clearNotifications();
    clearNotificationPreferences();
    clearMyWork();
    clearWorkspaceAdminState();
    clearOutboxState();
    clearDashboardWork();
    clearProjectMessages();
    clearProjectTemplates();
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
      <AuthPanel
        invitationMessage={invitationMessage}
        message={message}
        mode={mode}
        onModeChange={setMode}
        onRequestPasswordReset={requestPasswordReset}
        onResetPassword={resetPassword}
        onSubmitAuth={submitAuth}
        onVerifyEmail={verifyEmail}
        resetToken={resetToken}
        statusMessage={authStatusMessage}
        verifyToken={verifyToken}
      />
    );
  }

  const shellTabs: Array<{ id: typeof shellView; label: string; badge?: number }> = [
    { id: "home", label: "Home" },
    { id: "board", label: "Board" },
    { id: "inbox", label: "Inbox", badge: unreadCount || undefined },
    { id: "admin", label: "Admin" },
  ];

  return (
    <main className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">{user?.email}</p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">Atlas</h1>
            </div>
            <nav aria-label="Primary" className="flex flex-wrap gap-1.5">
              {shellTabs.map((tab) => (
                <button
                  className={shellView === tab.id ? "atlas-chip atlas-chip-active" : "atlas-chip"}
                  key={tab.id}
                  onClick={() => setShellView(tab.id)}
                  type="button"
                >
                  {tab.label}
                  {tab.badge ? <span className="ml-1 opacity-80">({tab.badge})</span> : null}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="atlas-chip">{realtimeStatus}</span>
            {presenceNames.length ? (
              <span className="atlas-chip" title={presenceNames.join(", ")}>
                Viewing: {presenceNames.slice(0, 3).join(", ")}
                {presenceNames.length > 3 ? " +" + (presenceNames.length - 3) : ""}
              </span>
            ) : null}
            {selectedWorkspace ? <span className="atlas-chip">{selectedWorkspace.name}</span> : null}
            <button className="atlas-btn" onClick={() => void manageSessions()} type="button">
              Sessions
            </button>
            <button className="atlas-btn" onClick={logout} type="button">
              Log out
            </button>
          </div>
        </header>

        {message ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
        {user && !user.emailVerifiedAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>Your email is not verified yet. Some invite flows work better after verification.</p>
            <button className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900" onClick={() => void resendEmailVerification()} type="button">
              Resend verification
            </button>
          </div>
        ) : null}

        {shellView === "home" ? (
          <div className="grid gap-4">
            <InviteAcceptancePanel
              onAcceptInvitation={acceptInvitation}
              onTokenChange={setInvitationToken}
              statusMessage={invitationMessage}
              token={invitationToken}
            />
            <WorkspaceDashboardPanel
              activities={activities}
              dashboardWorkStatus={dashboardWorkStatus}
              myWorkTasks={dashboardTasks}
              notifications={notifications}
              onChooseProject={(projectId) => {
                if (!auth) return Promise.resolve();
                setShellView("board");
                return chooseProject(auth.accessToken, selectedWorkspaceId, projectId);
              }}
              onCreateProject={createProject}
              onCreateTask={createTask}
              onOpenTask={async (task) => {
                setShellView("board");
                await openMyWorkTask(task);
              }}
              projects={projects}
              sections={sections}
              selectedProject={selectedProject}
              tasks={tasks}
              workspace={selectedWorkspace}
              workspaceMembers={workspaceMembers}
            />
            <MyWorkPanel
              dependencyFilter={myWorkDependencyFilter}
              dueFilter={myWorkDueFilter}
              onDependencyFilterChange={changeMyWorkDependencyFilter}
              onDueFilterChange={changeMyWorkDueFilter}
              onOpenTask={async (task) => {
                setShellView("board");
                await openMyWorkTask(task);
              }}
              onRefresh={refreshMyWork}
              onScopeFilterChange={changeMyWorkScopeFilter}
              onStatusFilterChange={changeMyWorkStatusFilter}
              scopeFilter={myWorkScopeFilter}
              statusFilter={myWorkStatusFilter}
              statusMessage={myWorkStatus}
              tasks={myWorkTasks}
              workspaceSelected={Boolean(selectedWorkspaceId)}
            />
            <WorkspaceSearchPanel
              hasMoreResults={hasMoreSearchResults}
              onLoadMore={loadMoreSearchResults}
              onOpenResult={async (result) => {
                setShellView("board");
                await openSearchResult(result);
              }}
              onQueryChange={setSearchQuery}
              onSearch={searchWorkspace}
              query={searchQuery}
              results={searchResults}
              statusMessage={searchStatus}
              workspace={selectedWorkspace}
              workspaceSelected={Boolean(selectedWorkspaceId)}
            />
          </div>
        ) : null}

        {shellView === "inbox" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <NotificationsPanel
              emailNotificationsEnabled={notificationPreference?.emailEnabled ?? false}
              filter={notificationFilter}
              notifications={notifications}
              onEmailNotificationsChange={updateNotificationEmailPreference}
              onFilterChange={setNotificationFilter}
              onMarkAllRead={markAllNotificationsRead}
              onMarkRead={markNotificationRead}
              onOpenTask={async (taskId, notificationId) => {
                await openNotificationTask(taskId, notificationId);
              }}
              preferenceStatus={notificationPreferenceStatus}
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
          </div>
        ) : null}

        {shellView === "admin" ? (
          <div className="grid gap-4">
            <ProjectTemplatesPanel
              onCreateProjectFromTemplate={createProjectFromTemplate}
              onDeleteTemplate={deleteProjectTemplate}
              onPreviewTemplate={previewProjectTemplate}
              onRefresh={refreshProjectTemplates}
              onSaveTemplate={saveProjectTemplate}
              onUpdateTemplate={updateProjectTemplate}
              project={selectedProject}
              selectedTemplate={selectedProjectTemplate}
              statusMessage={projectTemplatesStatus}
              templates={projectTemplates}
              workspaceSelected={Boolean(selectedWorkspaceId)}
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
            <ProjectMessagesPanel
              messages={projectMessages}
              onCreateMessage={createProjectMessage}
              onDeleteMessage={deleteProjectMessage}
              onPinMessage={pinProjectMessage}
              onRefresh={refreshProjectMessages}
              onUnpinMessage={unpinProjectMessage}
              onUpdateMessage={updateProjectMessage}
              project={selectedProject}
              statusMessage={projectMessagesStatus}
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
          </div>
        ) : null}

        {shellView === "board" ? (
          <section className="grid gap-3 lg:grid-cols-[200px_220px_minmax(0,1fr)_300px]">
            <aside className="grid content-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspaces</h2>
              <form className="grid gap-2" onSubmit={createWorkspace}>
                <input className="atlas-input" name="name" placeholder="Workspace name" required />
                <button className="atlas-btn atlas-btn-primary" type="submit">
                  Create
                </button>
              </form>
              <div className="grid gap-1.5">
                {workspaces.map((workspace) => (
                  <button
                    className={`rounded-md px-2.5 py-1.5 text-left text-sm ${
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

            <div className="grid gap-3">
              <BoardPanel
                onBulkComplete={completeTasksByIds}
                onBulkMove={moveTasksByIds}
                onChooseTask={chooseTask}
                onCreateSection={createSection}
                onCreateTask={createTask}
                onDeleteSection={deleteSection}
                onDependencyFilterChange={changeTaskDependencyFilter}
                onMoveSection={moveSection}
                onMoveTask={moveTaskToSection}
                onRenameSection={renameSection}
                projectName={selectedProject?.name}
                sections={sections}
                selectedTaskId={selectedTaskId}
                taskDependencyFilter={taskDependencyFilter}
                tasks={tasks}
                workspaceMembers={workspaceMembers}
              />
              <ProjectDependencyMapPanel dependencyMap={projectDependencyMap} onOpenTask={chooseTask} />
            </div>

            <TaskDetailPanel
              attachmentStatus={attachmentStatus}
              attachments={attachments}
              comments={comments}
              dependencies={taskDependencies}
              dependencyStatus={dependencyStatus}
              labelStatus={labelStatus}
              labels={workspaceLabels}
              members={workspaceMembers}
              onAddDependency={addTaskDependency}
              onAssignTask={assignTask}
              onAssignTaskLabel={assignTaskLabel}
              onCompleteTask={completeTask}
              onCompleteReadyBlockers={completeReadyBlockers}
              onCreateAttachmentComment={createAttachmentComment}
              onCreateComment={createComment}
              onCreateTaskLabel={createTaskLabel}
              onCreateSubtask={createSubtask}
              onDeleteAttachment={deleteAttachment}
              onDeleteAttachmentComment={deleteAttachmentComment}
              onDeleteComment={deleteComment}
              onDeleteSubtask={deleteSubtask}
              onDeleteTask={deleteTask}
              onDownloadAttachment={downloadAttachment}
              onReplaceAttachment={replaceAttachment}
              onRemoveDependency={removeTaskDependency}
              onSkipRecurringTask={skipRecurringTask}
              onToggleSubtask={toggleSubtask}
              onUnassignTask={unassignTask}
              onUnassignTaskLabel={unassignTaskLabel}
              onUnwatchTask={unwatchTask}
              onUpdateAttachmentComment={updateAttachmentComment}
              onUpdateAttachmentDescription={updateAttachmentDescription}
              onUpdateComment={updateComment}
              onUpdateTask={updateTaskDetails}
              onUploadAttachment={uploadAttachment}
              onWatchTask={watchTask}
              sections={sections}
              subtasks={subtasks}
              task={selectedTask}
              taskLabels={taskLabels}
              taskWatchers={taskWatchers}
              tasks={tasks}
              watcherStatus={watcherStatus}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
