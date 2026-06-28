"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

type User = {
  email: string;
  id: string;
  name: string;
};

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

type Project = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "WORKSPACE";
};

type Section = {
  id: string;
  name: string;
};

type Task = {
  id: string;
  sectionId: string;
  status: string;
  title: string;
  version: number;
};

type Comment = {
  body: string;
  createdAt: string;
  id: string;
};

type Page<T> = {
  items: T[];
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AtlasClient({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [auth, setAuth] = useState<AuthPair | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("offline");

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId), [selectedTaskId, tasks]);

  useEffect(() => {
    const storedAccessToken = window.localStorage.getItem("atlas.accessToken");
    const storedRefreshToken = window.localStorage.getItem("atlas.refreshToken");
    if (!storedAccessToken || !storedRefreshToken) return;
    const storedAuth = { accessToken: storedAccessToken, refreshToken: storedRefreshToken, tokenType: "Bearer" };
    setAuth(storedAuth);
    void hydrate(storedAuth);
  }, []);

  useEffect(() => {
    if (!auth?.accessToken || !selectedWorkspaceId) return;
    const socket = new WebSocket(websocketUrl(auth.accessToken));
    socket.onopen = () => {
      setRealtimeStatus("connected");
      socket.send(
        JSON.stringify({
          action: "subscribe",
          id: selectedProjectId || selectedWorkspaceId,
          scope: selectedProjectId ? "project" : "workspace",
        }),
      );
    };
    socket.onclose = () => setRealtimeStatus("offline");
    socket.onerror = () => setRealtimeStatus("error");
    socket.onmessage = () => {
      setRealtimeStatus("updated");
      if (selectedProjectId) void loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
      if (selectedTaskId) void loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    };
    return () => socket.close();
  }, [auth?.accessToken, selectedWorkspaceId, selectedProjectId, selectedTaskId]);

  async function hydrate(currentAuth: AuthPair) {
    try {
      const me = await api<{ user: User }>("/auth/me", {}, currentAuth.accessToken);
      setUser(me.user);
      const workspacePage = await api<Page<Workspace>>("/workspaces", {}, currentAuth.accessToken);
      setWorkspaces(workspacePage.items);
      if (workspacePage.items[0]) await chooseWorkspace(currentAuth.accessToken, workspacePage.items[0].id);
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
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name"));
    const slug = slugify(name);
    const workspace = await api<Workspace>(
      "/workspaces",
      { body: JSON.stringify({ name, slug }), method: "POST" },
      auth.accessToken,
    );
    await hydrate(auth);
    setSelectedWorkspaceId(workspace.id);
    event.currentTarget.reset();
  }

  async function chooseWorkspace(accessToken: string, workspaceId: string) {
    setSelectedWorkspaceId(workspaceId);
    setSelectedProjectId("");
    setSelectedTaskId("");
    setComments([]);
    const projectPage = await api<Page<Project>>(`/workspaces/${workspaceId}/projects`, {}, accessToken);
    setProjects(projectPage.items);
    if (projectPage.items[0]) await chooseProject(accessToken, workspaceId, projectPage.items[0].id);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId) return;
    const form = new FormData(event.currentTarget);
    const project = await api<Project>(
      `/workspaces/${selectedWorkspaceId}/projects`,
      { body: JSON.stringify({ name: String(form.get("name")), visibility: "WORKSPACE" }), method: "POST" },
      auth.accessToken,
    );
    await chooseWorkspace(auth.accessToken, selectedWorkspaceId);
    await chooseProject(auth.accessToken, selectedWorkspaceId, project.id);
    event.currentTarget.reset();
  }

  async function chooseProject(accessToken: string, workspaceId: string, projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedTaskId("");
    setComments([]);
    await loadProjectData(accessToken, workspaceId, projectId);
  }

  async function loadProjectData(accessToken: string, workspaceId: string, projectId: string) {
    const [sectionPage, taskPage] = await Promise.all([
      api<Page<Section>>(`/workspaces/${workspaceId}/projects/${projectId}/sections`, {}, accessToken),
      api<Page<Task>>(`/workspaces/${workspaceId}/projects/${projectId}/tasks`, {}, accessToken),
    ]);
    setSections(sectionPage.items);
    setTasks(taskPage.items);
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId) return;
    const form = new FormData(event.currentTarget);
    await api<Section>(
      `/workspaces/${selectedWorkspaceId}/projects/${selectedProjectId}/sections`,
      { body: JSON.stringify({ name: String(form.get("name")), position: Date.now() }), method: "POST" },
      auth.accessToken,
    );
    await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    event.currentTarget.reset();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedProjectId || !sections[0]) return;
    const form = new FormData(event.currentTarget);
    const sectionId = String(form.get("sectionId") || sections[0].id);
    await api<Task>(
      `/workspaces/${selectedWorkspaceId}/projects/${selectedProjectId}/tasks`,
      { body: JSON.stringify({ sectionId, title: String(form.get("title")) }), method: "POST" },
      auth.accessToken,
    );
    await loadProjectData(auth.accessToken, selectedWorkspaceId, selectedProjectId);
    event.currentTarget.reset();
  }

  async function chooseTask(taskId: string) {
    setSelectedTaskId(taskId);
    if (auth && selectedWorkspaceId) await loadComments(auth.accessToken, selectedWorkspaceId, taskId);
  }

  async function loadComments(accessToken: string, workspaceId: string, taskId: string) {
    const commentPage = await api<Page<Comment>>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`, {}, accessToken);
    setComments(commentPage.items);
  }

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth || !selectedWorkspaceId || !selectedTaskId) return;
    const form = new FormData(event.currentTarget);
    await api<Comment>(
      `/workspaces/${selectedWorkspaceId}/tasks/${selectedTaskId}/comments`,
      { body: JSON.stringify({ body: String(form.get("body")) }), method: "POST" },
      auth.accessToken,
    );
    await loadComments(auth.accessToken, selectedWorkspaceId, selectedTaskId);
    event.currentTarget.reset();
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

          <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">{selectedWorkspace?.name ?? "Projects"}</h2>
            <form className="grid gap-2" onSubmit={createProject}>
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Project name" required />
              <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create
              </button>
            </form>
            <div className="grid gap-2">
              {projects.map((project) => (
                <button
                  className={`rounded-md px-3 py-2 text-left text-sm ${
                    project.id === selectedProjectId ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  key={project.id}
                  onClick={() => auth && void chooseProject(auth.accessToken, selectedWorkspaceId, project.id)}
                  type="button"
                >
                  {project.name}
                </button>
              ))}
            </div>
          </aside>

          <section className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase text-slate-500">{selectedProject?.name ?? "Tasks"}</h2>
              <form className="flex gap-2" onSubmit={createSection}>
                <input className="w-36 rounded-md border border-slate-300 px-3 py-2 text-sm" name="name" placeholder="Section" required />
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" type="submit">
                  Add
                </button>
              </form>
            </div>

            <form className="grid gap-2 md:grid-cols-[1fr_180px_auto]" onSubmit={createTask}>
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" placeholder="Task title" required />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="sectionId">
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                Add task
              </button>
            </form>

            <div className="grid gap-4 md:grid-cols-3">
              {sections.map((section) => (
                <div className="min-h-48 rounded-lg border border-slate-200 bg-slate-50 p-3" key={section.id}>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">{section.name}</h3>
                  <div className="grid gap-2">
                    {tasks
                      .filter((task) => task.sectionId === section.id)
                      .map((task) => (
                        <button
                          className={`rounded-md border px-3 py-2 text-left text-sm ${
                            task.id === selectedTaskId ? "border-slate-950 bg-white" : "border-slate-200 bg-white"
                          }`}
                          key={task.id}
                          onClick={() => void chooseTask(task.id)}
                          type="button"
                        >
                          <span className="block font-medium text-slate-900">{task.title}</span>
                          <span className="text-xs text-slate-500">{task.status}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="grid content-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase text-slate-500">{selectedTask?.title ?? "Comments"}</h2>
            {selectedTask ? (
              <form className="grid gap-2" onSubmit={createComment}>
                <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" name="body" required />
                <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="submit">
                  Comment
                </button>
              </form>
            ) : null}
            <div className="grid gap-2">
              {comments.map((comment) => (
                <article className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" key={comment.id}>
                  <p className="text-slate-800">{comment.body}</p>
                  <time className="mt-2 block text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</time>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

async function api<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  const data = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(apiErrorMessage(data) ?? "Request failed.");
  }
  return data as T;
}

function apiErrorMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) return undefined;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object" || !("message" in error)) return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function storeSession(auth: AuthPair) {
  window.localStorage.setItem("atlas.accessToken", auth.accessToken);
  window.localStorage.setItem("atlas.refreshToken", auth.refreshToken);
}

function clearSession() {
  window.localStorage.removeItem("atlas.accessToken");
  window.localStorage.removeItem("atlas.refreshToken");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function slugify(value: string) {
  return `${value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
}

function websocketUrl(accessToken: string) {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  url.searchParams.set("accessToken", accessToken);
  return url.toString();
}
