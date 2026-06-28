const STORAGE_KEY = "workline-state-v1";
const CURRENT_USER = "p1";

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h4l2 3h4l2-3h4M5 5h14l2 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  "check-square": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11.5 11.2 14 16 8.5M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 7c0-1.6-.8-3-2-3.7M16.5 7a2.5 2.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  board: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h6v14H4zm10 0h6v8h-6zm0 11h6v3h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  timeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6v12M19 6v12M8 8h7M10 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7l1-3h4l1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const palette = ["#e45d42", "#2f6fed", "#188b7c", "#f2b84b", "#7a5cff"];
const viewConfig = [
  ["list", "List", "list"],
  ["board", "Board", "board"],
  ["timeline", "Timeline", "timeline"],
  ["calendar", "Calendar", "calendar"],
  ["dashboard", "Dashboard", "chart"],
];
const filters = [
  ["all", "All open"],
  ["mine", "Assigned to me"],
  ["high", "High priority"],
  ["week", "Due this week"],
  ["blocked", "Blocked"],
  ["done", "Done"],
];

let state = loadState();
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  injectStaticIcons();
  bindEvents();
  render();
});

function cacheElements() {
  els.projectList = document.getElementById("projectList");
  els.pageTitle = document.getElementById("pageTitle");
  els.headerPanel = document.getElementById("headerPanel");
  els.mainView = document.getElementById("mainView");
  els.globalSearch = document.getElementById("globalSearch");
  els.railInbox = document.getElementById("railInbox");
  els.railGoals = document.getElementById("railGoals");
  els.railWorkload = document.getElementById("railWorkload");
  els.drawer = document.getElementById("taskDrawer");
  els.scrim = document.getElementById("drawerScrim");
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("dragstart", handleDragStart);
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
}

function handleClick(event) {
  const scopeButton = event.target.closest("[data-scope]");
  if (scopeButton) {
    state.ui.scope = scopeButton.dataset.scope;
    if (state.ui.scope !== "project") closeDrawer();
    persist();
    render();
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.ui.scope = "project";
    state.ui.activeView = viewButton.dataset.view;
    persist();
    render();
    return;
  }

  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) {
    state.ui.scope = "project";
    state.ui.activeProjectId = projectButton.dataset.projectId;
    persist();
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const taskId = actionButton.dataset.taskId;

  if (action === "add-task") {
    openTask(createTask());
  }

  if (action === "open-task") {
    openTask(taskId);
  }

  if (action === "close-drawer") {
    closeDrawer();
  }

  if (action === "toggle-task") {
    toggleTask(taskId);
  }

  if (action === "delete-task") {
    deleteTask(taskId);
  }

  if (action === "new-project") {
    createProject();
  }

  if (action === "reset-demo") {
    resetDemo();
  }

  if (action === "add-subtask") {
    addSubtask(taskId);
  }

  if (action === "toggle-subtask") {
    toggleSubtask(taskId, actionButton.dataset.subtaskId);
  }

  if (action === "calendar-prev" || action === "calendar-next") {
    shiftCalendar(action === "calendar-next" ? 1 : -1);
  }
}

function handleInput(event) {
  if (event.target.id === "globalSearch") {
    state.ui.search = event.target.value;
    persist(false);
    render();
    return;
  }

  const field = event.target.dataset.field;
  if (!field) return;
  updateTaskField(field, event.target.value);
}

function handleChange(event) {
  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) return;

  const selectFilter = event.target.dataset.filterSelect;
  if (selectFilter) {
    state.ui.filter = event.target.value;
    persist();
    render();
    return;
  }

  const field = event.target.dataset.field;
  if (field) updateTaskField(field, event.target.value);
}

function handleDragStart(event) {
  const card = event.target.closest("[data-drag-task]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.dragTask);
  event.dataTransfer.effectAllowed = "move";
}

function handleDragOver(event) {
  const column = event.target.closest("[data-drop-section]");
  if (!column) return;
  event.preventDefault();
  column.classList.add("drag-over");
}

function handleDragLeave(event) {
  const column = event.target.closest("[data-drop-section]");
  if (column) column.classList.remove("drag-over");
}

function handleDrop(event) {
  const column = event.target.closest("[data-drop-section]");
  if (!column) return;
  event.preventDefault();
  column.classList.remove("drag-over");
  const task = findTask(event.dataTransfer.getData("text/plain"));
  if (!task) return;
  task.section = column.dataset.dropSection;
  task.status = column.dataset.dropSection === "Done" ? "Done" : "On track";
  task.completed = column.dataset.dropSection === "Done";
  task.updatedAt = todayISO();
  persist();
  render();
}

function render() {
  normalizeState();
  renderProjectList();
  renderMain();
  renderRightRail();
  renderDrawer();
  injectStaticIcons();
}

function renderProjectList() {
  els.projectList.innerHTML = state.projects
    .map((project) => {
      const active = state.ui.scope === "project" && project.id === state.ui.activeProjectId ? " is-active" : "";
      return `
        <button class="project-item${active}" type="button" data-project-id="${project.id}">
          <span class="project-color" style="background:${project.color}"></span>
          <span>${escapeHtml(project.name)}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-scope]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scope === state.ui.scope);
  });
}

function renderMain() {
  const search = state.ui.search || "";
  if (els.globalSearch.value !== search) els.globalSearch.value = search;

  const scope = state.ui.scope;
  if (scope === "project") return renderProjectScope();
  if (scope === "my") return renderMyTasks();
  if (scope === "inbox") return renderInbox();
  if (scope === "goals") return renderGoals();
  if (scope === "workload") return renderWorkload();
  return renderHome();
}

function renderProjectScope() {
  const project = activeProject();
  const tasks = filteredTasks(projectTasks(project.id));
  const allProjectTasks = projectTasks(project.id);
  const complete = allProjectTasks.filter((task) => task.completed).length;
  const progress = allProjectTasks.length ? Math.round((complete / allProjectTasks.length) * 100) : 0;
  const dueSoon = allProjectTasks.filter((task) => !task.completed && daysUntil(task.dueDate) <= 7).length;

  els.pageTitle.textContent = project.name;
  els.headerPanel.innerHTML = `
    <div class="project-hero">
      <div>
        <div class="hero-title-row">
          <div class="project-title">
            <h2>${escapeHtml(project.name)}</h2>
            <p>${escapeHtml(project.description)}</p>
          </div>
          ${statusPill(project.status)}
        </div>
        <div class="view-tabs" role="tablist" aria-label="Project views">
          ${viewConfig
            .map(([id, label, icon]) => `
              <button class="view-tab${state.ui.activeView === id ? " is-active" : ""}" type="button" data-view="${id}" role="tab">
                ${iconHtml(icon)}
                <span>${label}</span>
              </button>
            `)
            .join("")}
        </div>
      </div>
      <div class="hero-metrics">
        <div class="metric">
          <span class="metric-label">Progress</span>
          <span class="metric-value">${progress}%</span>
          <div class="progress-track"><span class="progress-fill" style="width:${progress}%"></span></div>
        </div>
        <div class="metric-row">
          <div class="metric">
            <span class="metric-label">Owner</span>
            <span class="metric-value">${escapeHtml(person(project.ownerId).name)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Due soon</span>
            <span class="metric-value">${dueSoon}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const toolbar = `
    <div class="toolbar">
      <div class="filter-group" aria-label="Task filters">
        ${filters
          .map(([id, label]) => `
            <button class="filter-chip${state.ui.filter === id ? " is-active" : ""}" type="button" data-filter="${id}" onclick="window.worklineSetFilter('${id}')">
              ${id === "all" ? iconHtml("filter") : ""}
              <span>${label}</span>
            </button>
          `)
          .join("")}
      </div>
      <button class="secondary-action" type="button" data-action="add-task">${iconHtml("plus")}<span>Add task</span></button>
    </div>
  `;

  const view = state.ui.activeView;
  els.mainView.innerHTML = toolbar + renderProjectView(project, tasks, allProjectTasks, view);
}

function renderProjectView(project, tasks, allProjectTasks, view) {
  if (view === "board") return renderBoard(project, tasks);
  if (view === "timeline") return renderTimeline(tasks);
  if (view === "calendar") return renderCalendar(tasks);
  if (view === "dashboard") return renderDashboard(project, allProjectTasks);
  return renderList(project, tasks);
}

function renderList(project, tasks) {
  const grouped = groupBySections(project.sections, tasks);
  if (!tasks.length) return emptyState("No tasks match the current search or filter.");

  return `
    <div class="list-view">
      ${project.sections
        .map((section) => `
          <section class="task-section">
            <header class="section-header">
              <span>${escapeHtml(section)}</span>
              <span>${grouped[section].length}</span>
            </header>
            ${grouped[section].length ? renderTaskTable(grouped[section]) : `<div class="empty-state">No tasks in ${escapeHtml(section)}.</div>`}
          </section>
        `)
        .join("")}
    </div>
  `;
}

function renderTaskTable(tasks) {
  return `
    <table class="task-table">
      <colgroup>
        <col />
        <col style="width:160px" />
        <col style="width:120px" />
        <col style="width:120px" />
        <col style="width:90px" />
      </colgroup>
      <thead>
        <tr>
          <th>Task</th>
          <th>Assignee</th>
          <th>Priority</th>
          <th>Due</th>
          <th>Effort</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(renderTaskRow).join("")}
      </tbody>
    </table>
  `;
}

function renderTaskRow(task) {
  const owner = person(task.assigneeId);
  return `
    <tr>
      <td>
        <div class="task-name-cell">
          <button class="check-control${task.completed ? " is-done" : ""}" type="button" data-action="toggle-task" data-task-id="${task.id}" aria-label="Toggle completion">
            ${task.completed ? iconHtml("check") : ""}
          </button>
          <button class="task-link${task.completed ? " is-done" : ""}" type="button" data-action="open-task" data-task-id="${task.id}">
            <span>${escapeHtml(task.title)}</span>
          </button>
        </div>
      </td>
      <td><span class="assignee">${avatar(owner)}<span>${escapeHtml(owner.name)}</span></span></td>
      <td>${priorityPill(task.priority)}</td>
      <td>${datePill(task.dueDate)}</td>
      <td>${task.effort}h</td>
    </tr>
  `;
}

function renderBoard(project, tasks) {
  const grouped = groupBySections(project.sections, tasks);
  return `
    <div class="board-view">
      ${project.sections
        .map((section) => `
          <section class="board-column" data-drop-section="${escapeHtml(section)}">
            <header class="section-header">
              <span>${escapeHtml(section)}</span>
              <span>${grouped[section].length}</span>
            </header>
            <div class="board-cards">
              ${grouped[section].map(renderTaskCard).join("") || `<div class="empty-state">Drop tasks here.</div>`}
            </div>
          </section>
        `)
        .join("")}
    </div>
  `;
}

function renderTaskCard(task) {
  const owner = person(task.assigneeId);
  return `
    <article class="task-card${task.completed ? " is-done" : ""}" draggable="true" data-drag-task="${task.id}">
      <button class="task-card-title${task.completed ? " is-done" : ""}" type="button" data-action="open-task" data-task-id="${task.id}">
        ${escapeHtml(task.title)}
      </button>
      <div class="task-meta">
        ${avatar(owner, "small")}
        ${priorityPill(task.priority)}
        ${datePill(task.dueDate)}
      </div>
      <div class="task-meta">
        ${task.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderTimeline(tasks) {
  if (!tasks.length) return emptyState("No tasks to place on the timeline.");
  const range = timelineRange(tasks);
  return `
    <div class="timeline-wrap">
      <div class="timeline-grid">
        <div class="timeline-scale">
          <span>Task</span>
          ${range.ticks.map((tick) => `<span>${formatShortDate(tick)}</span>`).join("")}
        </div>
        ${tasks
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
          .map((task) => renderTimelineRow(task, range))
          .join("")}
      </div>
    </div>
  `;
}

function renderTimelineRow(task, range) {
  const start = clamp(daysBetween(range.start, task.startDate), 0, range.totalDays);
  const end = clamp(daysBetween(range.start, task.dueDate), start + 1, range.totalDays);
  const left = (start / range.totalDays) * 100;
  const width = Math.max(((end - start) / range.totalDays) * 100, 4);
  return `
    <div class="timeline-row">
      <div class="timeline-label">${escapeHtml(task.title)}</div>
      <div class="timeline-lane">
        <button class="timeline-bar" style="left:${left}%;width:${width}%;background:${taskColor(task)}" type="button" data-action="open-task" data-task-id="${task.id}">
          ${escapeHtml(task.title)}
        </button>
      </div>
    </div>
  `;
}

function renderCalendar(tasks) {
  const monthDate = new Date(state.ui.calendarMonth || todayISO());
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const dueMap = tasks.reduce((map, task) => {
    if (!map[task.dueDate]) map[task.dueDate] = [];
    map[task.dueDate].push(task);
    return map;
  }, {});

  return `
    <div class="calendar-view">
      <header class="calendar-head">
        <button class="icon-button" type="button" data-action="calendar-prev" aria-label="Previous month">${iconHtml("arrow")}</button>
        <strong>${monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <button class="icon-button" type="button" data-action="calendar-next" aria-label="Next month">${iconHtml("arrow")}</button>
      </header>
      <div class="calendar-grid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="calendar-day-name">${day}</div>`).join("")}
        ${cells
          .map((date) => {
            const iso = toISO(date);
            const isMuted = date.getMonth() !== month;
            return `
              <div class="calendar-cell${isMuted ? " is-muted" : ""}">
                <span class="calendar-date">${date.getDate()}</span>
                ${(dueMap[iso] || [])
                  .slice(0, 4)
                  .map((task) => `<button class="calendar-task" type="button" data-action="open-task" data-task-id="${task.id}">${escapeHtml(task.title)}</button>`)
                  .join("")}
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderDashboard(project, tasks) {
  const totals = taskTotals(tasks);
  const donePercent = tasks.length ? Math.round((totals.done / tasks.length) * 100) : 0;
  return `
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-title">${iconHtml("chart")}<span>Status</span></div>
        <div class="donut-wrap">
          <div class="donut" data-percent="${donePercent}%" style="--done:${totals.donePercent}%;--doing:${totals.doingPercent}%;--blocked:${totals.blockedPercent}%"></div>
          <div class="legend">
            <div class="legend-item"><span><span class="dot" style="background:var(--green)"></span>Done</span><strong>${totals.done}</strong></div>
            <div class="legend-item"><span><span class="dot" style="background:var(--yellow)"></span>In motion</span><strong>${totals.doing}</strong></div>
            <div class="legend-item"><span><span class="dot" style="background:var(--red)"></span>Blocked</span><strong>${totals.blocked}</strong></div>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-title">${iconHtml("filter")}<span>Priority mix</span></div>
        <div class="bar-list">
          ${["High", "Medium", "Low"].map((priority) => renderBar(priority, tasks.filter((task) => task.priority === priority).length, Math.max(tasks.length, 1), priorityColor(priority))).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-title">${iconHtml("target")}<span>Project goal</span></div>
        ${renderGoalCard(state.goals.find((goal) => goal.projectId === project.id) || state.goals[0])}
      </section>
      <section class="panel">
        <div class="panel-title">${iconHtml("users")}<span>Team load</span></div>
        <div class="bar-list">${renderWorkloadBars(tasks)}</div>
      </section>
    </div>
  `;
}

function renderHome() {
  els.pageTitle.textContent = "Home";
  els.headerPanel.innerHTML = `
    <div class="scope-hero">
      <h2>Active work across the workspace</h2>
      <p>Projects, priorities, upcoming deadlines, and goals stay visible from one operating surface.</p>
    </div>
  `;

  const projects = state.projects.map((project) => {
    const tasks = projectTasks(project.id);
    const done = tasks.filter((task) => task.completed).length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const nextTasks = tasks
      .filter((task) => !task.completed)
      .sort(byDueDate)
      .slice(0, 3);
    return `
      <article class="home-card">
        <div class="goal-title-row">
          <h3>${escapeHtml(project.name)}</h3>
          ${statusPill(project.status)}
        </div>
        <p>${escapeHtml(project.description)}</p>
        <div class="progress-track"><span class="progress-fill" style="width:${progress}%;background:${project.color}"></span></div>
        <div class="mini-list">
          ${nextTasks.map(renderMiniTask).join("") || `<div class="rail-empty">No open tasks.</div>`}
        </div>
      </article>
    `;
  });

  els.mainView.innerHTML = `<div class="home-grid">${projects.join("")}</div>`;
}

function renderMyTasks() {
  els.pageTitle.textContent = "My Tasks";
  els.headerPanel.innerHTML = `
    <div class="scope-hero">
      <h2>My Tasks</h2>
      <p>A focused queue for work assigned to ${escapeHtml(person(CURRENT_USER).name)}, grouped by urgency.</p>
    </div>
  `;

  const tasks = filteredTasks(state.tasks.filter((task) => task.assigneeId === CURRENT_USER));
  const groups = {
    Overdue: tasks.filter((task) => !task.completed && daysUntil(task.dueDate) < 0),
    Today: tasks.filter((task) => !task.completed && daysUntil(task.dueDate) === 0),
    Upcoming: tasks.filter((task) => !task.completed && daysUntil(task.dueDate) > 0 && daysUntil(task.dueDate) <= 7),
    Later: tasks.filter((task) => !task.completed && daysUntil(task.dueDate) > 7),
    Done: tasks.filter((task) => task.completed),
  };

  els.mainView.innerHTML = `
    <div class="list-view">
      ${Object.entries(groups)
        .map(([label, items]) => `
          <section class="task-section">
            <header class="section-header"><span>${label}</span><span>${items.length}</span></header>
            ${items.length ? renderTaskTable(items.sort(byDueDate)) : `<div class="empty-state">Nothing here.</div>`}
          </section>
        `)
        .join("")}
    </div>
  `;
}

function renderInbox() {
  els.pageTitle.textContent = "Inbox";
  els.headerPanel.innerHTML = `
    <div class="scope-hero">
      <h2>Inbox</h2>
      <p>Status changes, comments, and due-date movements appear here as a lightweight activity feed.</p>
    </div>
  `;
  const updates = inboxItems();
  els.mainView.innerHTML = `
    <div class="list-view">
      ${updates.map(renderInboxItem).join("") || emptyState("No updates yet.")}
    </div>
  `;
}

function renderGoals() {
  els.pageTitle.textContent = "Goals";
  els.headerPanel.innerHTML = `
    <div class="scope-hero">
      <h2>Goals</h2>
      <p>Outcome tracking tied directly to active projects and their task completion.</p>
    </div>
  `;
  els.mainView.innerHTML = `<div class="goals-grid">${state.goals.map(renderGoalCard).join("")}</div>`;
}

function renderWorkload() {
  els.pageTitle.textContent = "Workload";
  els.headerPanel.innerHTML = `
    <div class="scope-hero">
      <h2>Workload</h2>
      <p>Open effort by assignee so overloaded work is visible before deadlines slip.</p>
    </div>
  `;
  const cards = state.people
    .map((member) => {
      const tasks = state.tasks.filter((task) => task.assigneeId === member.id && !task.completed);
      const effort = tasks.reduce((sum, task) => sum + Number(task.effort || 0), 0);
      return `
        <article class="person-card">
          <div class="workload-person">
            <span class="assignee">${avatar(member)}<strong>${escapeHtml(member.name)}</strong></span>
            <strong>${effort}h</strong>
          </div>
          ${workloadTrack(effort)}
          <div class="mini-list">${tasks.sort(byDueDate).slice(0, 4).map(renderMiniTask).join("") || `<div class="rail-empty">No open work.</div>`}</div>
        </article>
      `;
    })
    .join("");
  els.mainView.innerHTML = `<div class="workload-grid">${cards}</div>`;
}

function renderRightRail() {
  const inbox = inboxItems().slice(0, 4);
  els.railInbox.innerHTML = `<div class="rail-stack">${inbox.map(renderRailInboxItem).join("") || `<div class="rail-empty">No recent updates.</div>`}</div>`;
  els.railGoals.innerHTML = `<div class="rail-stack">${state.goals.slice(0, 3).map(renderRailGoal).join("")}</div>`;
  els.railWorkload.innerHTML = `<div class="rail-stack">${renderWorkloadBars(state.tasks.filter((task) => !task.completed))}</div>`;
}

function renderDrawer() {
  const task = findTask(state.ui.activeTaskId);
  const open = Boolean(task);
  els.drawer.classList.toggle("is-open", open);
  els.scrim.classList.toggle("is-open", open);
  els.drawer.setAttribute("aria-hidden", open ? "false" : "true");
  if (!task) {
    els.drawer.innerHTML = "";
    return;
  }

  const project = state.projects.find((item) => item.id === task.projectId) || activeProject();
  els.drawer.innerHTML = `
    <div class="drawer-top">
      <strong>Task details</strong>
      <div class="drawer-actions">
        <button class="icon-button" type="button" data-action="delete-task" data-task-id="${task.id}" aria-label="Delete task">${iconHtml("trash")}</button>
        <button class="icon-button" type="button" data-action="close-drawer" aria-label="Close details">${iconHtml("close")}</button>
      </div>
    </div>
    <div class="drawer-body">
      <input class="drawer-title" data-field="title" value="${escapeAttr(task.title)}" aria-label="Task title" />
      <div class="form-grid">
        <div class="field">
          <label>Project</label>
          <select data-field="projectId">
            ${state.projects.map((item) => `<option value="${item.id}" ${item.id === task.projectId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Section</label>
          <select data-field="section">
            ${project.sections.map((section) => `<option value="${escapeAttr(section)}" ${section === task.section ? "selected" : ""}>${escapeHtml(section)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Assignee</label>
          <select data-field="assigneeId">
            ${state.people.map((member) => `<option value="${member.id}" ${member.id === task.assigneeId ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Priority</label>
          <select data-field="priority">
            ${["High", "Medium", "Low"].map((priority) => `<option ${priority === task.priority ? "selected" : ""}>${priority}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Start</label>
          <input type="date" data-field="startDate" value="${escapeAttr(task.startDate)}" />
        </div>
        <div class="field">
          <label>Due</label>
          <input type="date" data-field="dueDate" value="${escapeAttr(task.dueDate)}" />
        </div>
        <div class="field">
          <label>Status</label>
          <select data-field="status">
            ${["On track", "At risk", "Blocked", "Done"].map((status) => `<option ${status === task.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Effort</label>
          <input type="number" min="1" max="24" data-field="effort" value="${Number(task.effort || 1)}" />
        </div>
        <div class="field full">
          <label>Description</label>
          <textarea data-field="description">${escapeHtml(task.description || "")}</textarea>
        </div>
        <div class="field full">
          <label>Tags</label>
          <input data-field="tags" value="${escapeAttr(task.tags.join(", "))}" />
        </div>
        <div class="field full">
          <label>Subtasks</label>
          <button class="ghost-action" type="button" data-action="add-subtask" data-task-id="${task.id}">${iconHtml("plus")}<span>Add subtask</span></button>
          <div class="subtask-list">
            ${task.subtasks.map((subtask) => `
              <div class="subtask-row">
                <button class="check-control${subtask.done ? " is-done" : ""}" type="button" data-action="toggle-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}" aria-label="Toggle subtask">${subtask.done ? iconHtml("check") : ""}</button>
                <span>${escapeHtml(subtask.title)}</span>
              </div>
            `).join("") || `<div class="rail-empty">No subtasks yet.</div>`}
          </div>
        </div>
        <div class="field full">
          <label>Comments</label>
          <div class="comment-list">
            ${task.comments.map((comment) => `
              <div class="comment-row">
                <p>${escapeHtml(comment.body)}</p>
                <small>${escapeHtml(person(comment.authorId).name)} - ${formatShortDate(comment.date)}</small>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMiniTask(task) {
  const project = state.projects.find((item) => item.id === task.projectId);
  return `
    <div class="mini-task">
      <button type="button" data-action="open-task" data-task-id="${task.id}">${escapeHtml(task.title)}</button>
      <div class="mini-meta">
        <span>${project ? escapeHtml(project.name) : "Project"}</span>
        <span>${formatDue(task.dueDate)}</span>
      </div>
    </div>
  `;
}

function renderInboxItem(item) {
  return `
    <article class="inbox-item">
      <button type="button" data-action="open-task" data-task-id="${item.task.id}">${escapeHtml(item.title)}</button>
      <div class="inbox-meta">
        <span>${escapeHtml(item.project.name)}</span>
        <span>${escapeHtml(item.meta)}</span>
      </div>
    </article>
  `;
}

function renderRailInboxItem(item) {
  return `
    <div class="rail-item">
      <button type="button" data-action="open-task" data-task-id="${item.task.id}">${escapeHtml(item.title)}</button>
      <div class="rail-meta">
        <span>${escapeHtml(item.project.name)}</span>
        <span>${escapeHtml(item.meta)}</span>
      </div>
    </div>
  `;
}

function renderGoalCard(goal) {
  if (!goal) return "";
  const project = state.projects.find((item) => item.id === goal.projectId);
  return `
    <article class="goal-card">
      <div class="goal-title-row">
        <h3>${escapeHtml(goal.name)}</h3>
        <strong>${goal.progress}%</strong>
      </div>
      <div class="goal-track"><span class="goal-fill" style="width:${goal.progress}%;background:${project ? project.color : "var(--teal)"}"></span></div>
      <p>${escapeHtml(goal.description)}</p>
      <div class="goal-meta">
        <span>${project ? escapeHtml(project.name) : "Workspace"}</span>
        <span>Owner: ${escapeHtml(person(goal.ownerId).name)}</span>
      </div>
    </article>
  `;
}

function renderRailGoal(goal) {
  return `
    <div class="rail-item">
      <strong>${escapeHtml(goal.name)}</strong>
      <div class="rail-meta"><span>${goal.progress}% complete</span></div>
      <div class="goal-track"><span class="goal-fill" style="width:${goal.progress}%"></span></div>
    </div>
  `;
}

function renderWorkloadBars(tasks) {
  return state.people
    .map((member) => {
      const effort = tasks.filter((task) => task.assigneeId === member.id && !task.completed).reduce((sum, task) => sum + Number(task.effort || 0), 0);
      return `
        <div class="bar-row">
          <header>
            <span class="assignee">${avatar(member, "small")}<span>${escapeHtml(member.name)}</span></span>
            <strong>${effort}h</strong>
          </header>
          ${workloadTrack(effort)}
        </div>
      `;
    })
    .join("");
}

function renderBar(label, value, total, color) {
  const width = Math.round((value / total) * 100);
  return `
    <div class="bar-row">
      <header><span>${label}</span><strong>${value}</strong></header>
      <div class="bar-track"><span class="bar-fill" style="width:${width}%;background:${color}"></span></div>
    </div>
  `;
}

function workloadTrack(effort) {
  const width = clamp((effort / 28) * 100, 0, 100);
  const className = effort >= 28 ? "is-hot" : effort >= 18 ? "is-busy" : "is-good";
  return `<div class="workload-track"><span class="workload-fill ${className}" style="width:${width}%"></span></div>`;
}

function createTask() {
  const project = activeProject();
  const task = {
    id: createId("t"),
    projectId: project.id,
    section: project.sections[0],
    title: "Untitled task",
    description: "",
    assigneeId: CURRENT_USER,
    priority: "Medium",
    status: "On track",
    startDate: todayISO(),
    dueDate: offsetDate(3),
    effort: 2,
    completed: false,
    tags: ["new"],
    subtasks: [],
    comments: [{ authorId: CURRENT_USER, body: "Task created.", date: todayISO() }],
    updatedAt: todayISO(),
  };
  state.tasks.unshift(task);
  state.ui.scope = "project";
  state.ui.activeProjectId = project.id;
  persist();
  render();
  return task.id;
}

function createProject() {
  const name = window.prompt("Project name");
  if (!name || !name.trim()) return;
  const project = {
    id: createId("pr"),
    name: name.trim(),
    color: palette[state.projects.length % palette.length],
    status: "On track",
    ownerId: CURRENT_USER,
    description: "A new project ready for tasks, timelines, and reporting.",
    sections: ["Backlog", "In progress", "Review", "Done"],
  };
  state.projects.push(project);
  state.goals.push({
    id: createId("g"),
    projectId: project.id,
    ownerId: CURRENT_USER,
    name: `${project.name} outcome`,
    description: "Define the measurable result for this project.",
    progress: 0,
  });
  state.ui.scope = "project";
  state.ui.activeProjectId = project.id;
  persist();
  render();
}

function openTask(taskId) {
  state.ui.activeTaskId = taskId;
  persist(false);
  render();
}

function closeDrawer() {
  state.ui.activeTaskId = null;
  persist(false);
  render();
}

function toggleTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.status = task.completed ? "Done" : "On track";
  task.section = task.completed ? "Done" : task.section === "Done" ? activeProject().sections[1] : task.section;
  task.updatedAt = todayISO();
  persist();
  render();
}

function deleteTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const confirmed = window.confirm(`Delete "${task.title}"?`);
  if (!confirmed) return;
  state.tasks = state.tasks.filter((item) => item.id !== taskId);
  state.ui.activeTaskId = null;
  persist();
  render();
}

function addSubtask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const title = window.prompt("Subtask name");
  if (!title || !title.trim()) return;
  task.subtasks.push({ id: createId("s"), title: title.trim(), done: false });
  task.updatedAt = todayISO();
  persist();
  render();
}

function toggleSubtask(taskId, subtaskId) {
  const task = findTask(taskId);
  if (!task) return;
  const subtask = task.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) return;
  subtask.done = !subtask.done;
  task.updatedAt = todayISO();
  persist();
  render();
}

function updateTaskField(field, value) {
  const task = findTask(state.ui.activeTaskId);
  if (!task) return;
  if (field === "tags") {
    task.tags = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (field === "effort") {
    task.effort = clamp(Number(value || 1), 1, 24);
  } else {
    task[field] = value;
  }

  if (field === "projectId") {
    const project = state.projects.find((item) => item.id === value);
    task.section = project.sections.includes(task.section) ? task.section : project.sections[0];
    state.ui.activeProjectId = value;
  }

  if (field === "status") {
    task.completed = value === "Done";
    if (task.completed) task.section = "Done";
  }

  if (field === "section") {
    task.completed = value === "Done";
    if (task.completed) task.status = "Done";
  }

  task.updatedAt = todayISO();
  persist();
  render();
}

function shiftCalendar(delta) {
  const date = new Date(state.ui.calendarMonth || todayISO());
  date.setMonth(date.getMonth() + delta);
  state.ui.calendarMonth = toISO(new Date(date.getFullYear(), date.getMonth(), 1));
  persist(false);
  render();
}

function resetDemo() {
  const confirmed = window.confirm("Reset local demo data?");
  if (!confirmed) return;
  state = seedState();
  persist();
  render();
}

window.worklineSetFilter = function setFilter(id) {
  state.ui.filter = id;
  persist();
  render();
};

function loadState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.warn("Could not load saved state", error);
  }
  return seedState();
}

function persist(write = true) {
  normalizeState();
  if (!write) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState() {
  if (!state.ui) state.ui = {};
  if (!state.ui.scope) state.ui.scope = "home";
  if (!state.ui.activeProjectId || !state.projects.some((project) => project.id === state.ui.activeProjectId)) {
    state.ui.activeProjectId = state.projects[0]?.id;
  }
  if (!state.ui.activeView) state.ui.activeView = "list";
  if (!state.ui.filter) state.ui.filter = "all";
  if (!state.ui.calendarMonth) state.ui.calendarMonth = toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  state.tasks.forEach((task) => {
    if (!Array.isArray(task.tags)) task.tags = [];
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    if (!Array.isArray(task.comments)) task.comments = [];
  });
}

function seedState() {
  return {
    ui: {
      scope: "home",
      activeProjectId: "pr1",
      activeView: "list",
      filter: "all",
      search: "",
      activeTaskId: null,
      calendarMonth: toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    },
    people: [
      { id: "p1", name: "Kevin Lee", initials: "KL", color: "#e45d42" },
      { id: "p2", name: "Maya Chen", initials: "MC", color: "#2f6fed" },
      { id: "p3", name: "Jon Bell", initials: "JB", color: "#188b7c" },
      { id: "p4", name: "Rina Patel", initials: "RP", color: "#7a5cff" },
    ],
    projects: [
      {
        id: "pr1",
        name: "Product Launch",
        color: "#e45d42",
        status: "At risk",
        ownerId: "p1",
        description: "Coordinate launch tasks, approvals, content, and cross-functional follow-through.",
        sections: ["Backlog", "In progress", "Review", "Done"],
      },
      {
        id: "pr2",
        name: "Client Onboarding",
        color: "#188b7c",
        status: "On track",
        ownerId: "p2",
        description: "Move new clients from signed agreement to kickoff with a clean, repeatable workflow.",
        sections: ["Intake", "Setup", "Waiting", "Complete"],
      },
      {
        id: "pr3",
        name: "Website Refresh",
        color: "#2f6fed",
        status: "On track",
        ownerId: "p3",
        description: "Refresh the public site with sharper messaging, better assets, and tighter conversion paths.",
        sections: ["Ideas", "Build", "QA", "Shipped"],
      },
    ],
    goals: [
      {
        id: "g1",
        projectId: "pr1",
        ownerId: "p1",
        name: "Launch readiness",
        description: "Reach 95% launch checklist completion before the release window.",
        progress: 62,
      },
      {
        id: "g2",
        projectId: "pr2",
        ownerId: "p2",
        name: "Onboarding cycle time",
        description: "Keep standard client onboarding under five business days.",
        progress: 74,
      },
      {
        id: "g3",
        projectId: "pr3",
        ownerId: "p3",
        name: "Site conversion lift",
        description: "Ship refreshed pages and measure a 12% lift in inquiry conversion.",
        progress: 48,
      },
    ],
    tasks: [
      seedTask("t1", "pr1", "In progress", "Finalize launch checklist", "p1", "High", offsetDate(-2), offsetDate(1), 5, "At risk", ["launch", "ops"], [
        ["Confirm rollback owner", true],
        ["Publish command-center links", false],
      ]),
      seedTask("t2", "pr1", "Review", "Approve pricing page copy", "p4", "High", offsetDate(-1), offsetDate(2), 3, "On track", ["copy", "site"], [
        ["Legal review", true],
        ["Final proofread", false],
      ]),
      seedTask("t3", "pr1", "Backlog", "Create customer announcement draft", "p2", "Medium", offsetDate(1), offsetDate(5), 4, "On track", ["email"], []),
      seedTask("t4", "pr1", "In progress", "QA demo workspace", "p3", "High", offsetDate(0), offsetDate(3), 6, "Blocked", ["qa", "demo"], [
        ["Seed test data", true],
        ["Validate mobile board", false],
      ]),
      seedTask("t5", "pr1", "Done", "Book launch review meeting", "p1", "Low", offsetDate(-6), offsetDate(-4), 1, "Done", ["meeting"], []),
      seedTask("t6", "pr2", "Intake", "Collect stakeholder contacts", "p2", "Medium", offsetDate(0), offsetDate(4), 3, "On track", ["client"], []),
      seedTask("t7", "pr2", "Setup", "Prepare kickoff workspace", "p1", "High", offsetDate(1), offsetDate(6), 5, "On track", ["template"], [
        ["Create client project", true],
        ["Add kickoff tasks", false],
      ]),
      seedTask("t8", "pr2", "Waiting", "Confirm billing contact", "p4", "Medium", offsetDate(-1), offsetDate(2), 2, "At risk", ["finance"], []),
      seedTask("t9", "pr2", "Complete", "Send welcome packet", "p2", "Low", offsetDate(-8), offsetDate(-6), 2, "Done", ["client"], []),
      seedTask("t10", "pr3", "Ideas", "Audit hero imagery", "p3", "Medium", offsetDate(0), offsetDate(7), 4, "On track", ["creative"], []),
      seedTask("t11", "pr3", "Build", "Implement inquiry form update", "p1", "High", offsetDate(-1), offsetDate(4), 7, "On track", ["frontend", "conversion"], [
        ["Wire validation states", false],
        ["Add event tracking", false],
      ]),
      seedTask("t12", "pr3", "QA", "Cross-device nav pass", "p4", "Medium", offsetDate(2), offsetDate(9), 4, "On track", ["qa"], []),
    ],
  };
}

function seedTask(id, projectId, section, title, assigneeId, priority, startDate, dueDate, effort, status, tags, subtasks) {
  return {
    id,
    projectId,
    section,
    title,
    assigneeId,
    priority,
    startDate,
    dueDate,
    effort,
    status,
    completed: status === "Done" || section === "Done" || section === "Complete" || section === "Shipped",
    tags,
    description: `${title} is part of the active workflow and should stay visible until ownership, timing, and next steps are clear.`,
    subtasks: subtasks.map(([subTitle, done], index) => ({ id: `${id}-s${index + 1}`, title: subTitle, done })),
    comments: [
      { authorId: assigneeId, body: "Latest update added to keep the team aligned.", date: offsetDate(-1) },
      { authorId: CURRENT_USER, body: "Please keep the due date current if scope changes.", date: todayISO() },
    ],
    updatedAt: todayISO(),
  };
}

function activeProject() {
  return state.projects.find((project) => project.id === state.ui.activeProjectId) || state.projects[0];
}

function projectTasks(projectId) {
  return state.tasks.filter((task) => task.projectId === projectId).sort(byDueDate);
}

function filteredTasks(tasks) {
  const query = (state.ui.search || "").trim().toLowerCase();
  let result = tasks;
  if (query) {
    result = result.filter((task) => {
      const project = state.projects.find((item) => item.id === task.projectId);
      const owner = person(task.assigneeId);
      return [task.title, task.description, task.section, task.priority, owner.name, project?.name || "", ...task.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }

  const filter = state.ui.filter;
  if (filter === "mine") result = result.filter((task) => task.assigneeId === CURRENT_USER && !task.completed);
  if (filter === "high") result = result.filter((task) => task.priority === "High" && !task.completed);
  if (filter === "week") result = result.filter((task) => !task.completed && daysUntil(task.dueDate) >= 0 && daysUntil(task.dueDate) <= 7);
  if (filter === "blocked") result = result.filter((task) => task.status === "Blocked");
  if (filter === "done") result = result.filter((task) => task.completed);
  if (filter === "all") result = result.filter((task) => !task.completed);
  return result.sort(byDueDate);
}

function groupBySections(sections, tasks) {
  const grouped = Object.fromEntries(sections.map((section) => [section, []]));
  tasks.forEach((task) => {
    if (!grouped[task.section]) grouped[task.section] = [];
    grouped[task.section].push(task);
  });
  return grouped;
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function person(personId) {
  return state.people.find((member) => member.id === personId) || state.people[0];
}

function inboxItems() {
  return state.tasks
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 12)
    .map((task) => {
      const project = state.projects.find((item) => item.id === task.projectId) || state.projects[0];
      const latest = task.comments[task.comments.length - 1];
      return {
        task,
        project,
        title: latest ? latest.body : `${task.title} was updated`,
        meta: `${person(task.assigneeId).name} - ${formatDue(task.dueDate)}`,
      };
    });
}

function taskTotals(tasks) {
  const done = tasks.filter((task) => task.completed).length;
  const blocked = tasks.filter((task) => !task.completed && task.status === "Blocked").length;
  const doing = Math.max(tasks.length - done - blocked, 0);
  const total = Math.max(tasks.length, 1);
  return {
    done,
    blocked,
    doing,
    donePercent: Math.round((done / total) * 100),
    blockedPercent: Math.round(((done + doing + blocked) / total) * 100),
    doingPercent: Math.round(((done + doing) / total) * 100),
  };
}

function timelineRange(tasks) {
  const starts = tasks.map((task) => new Date(task.startDate));
  const ends = tasks.map((task) => new Date(task.dueDate));
  const start = new Date(Math.min(...starts));
  start.setDate(start.getDate() - 2);
  const end = new Date(Math.max(...ends));
  end.setDate(end.getDate() + 3);
  const totalDays = Math.max(daysBetween(toISO(start), toISO(end)), 12);
  const tickCount = 12;
  const step = Math.max(Math.ceil(totalDays / tickCount), 1);
  const ticks = Array.from({ length: tickCount }, (_, index) => addDays(start, index * step));
  return { start: toISO(start), end: toISO(end), totalDays, ticks };
}

function injectStaticIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    node.innerHTML = ICONS[name] || "";
  });
}

function iconHtml(name) {
  return ICONS[name] || "";
}

function statusPill(status) {
  const className = status === "At risk" ? " at-risk" : status === "Blocked" ? " blocked" : "";
  return `<span class="status-pill${className}">${escapeHtml(status)}</span>`;
}

function priorityPill(priority) {
  return `<span class="priority-pill ${priority.toLowerCase()}">${escapeHtml(priority)}</span>`;
}

function datePill(date) {
  return `<span class="date-pill">${formatDue(date)}</span>`;
}

function avatar(member, size = "") {
  return `<span class="avatar ${size}" style="background:${member.color}" title="${escapeAttr(member.name)}">${escapeHtml(member.initials)}</span>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function taskColor(task) {
  if (task.status === "Blocked") return "var(--red)";
  if (task.priority === "High") return "var(--accent)";
  if (task.priority === "Medium") return "var(--yellow)";
  return "var(--teal)";
}

function priorityColor(priority) {
  if (priority === "High") return "var(--accent)";
  if (priority === "Medium") return "var(--yellow)";
  return "var(--teal)";
}

function byDueDate(a, b) {
  return new Date(a.dueDate) - new Date(b.dueDate);
}

function todayISO() {
  return toISO(new Date());
}

function offsetDate(days) {
  return toISO(addDays(new Date(), days));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function daysUntil(date) {
  return daysBetween(todayISO(), date);
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

function formatDue(date) {
  const delta = daysUntil(date);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta < 0) return `${Math.abs(delta)}d overdue`;
  if (delta <= 7) return `${delta}d`;
  return formatShortDate(date);
}

function formatShortDate(date) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
