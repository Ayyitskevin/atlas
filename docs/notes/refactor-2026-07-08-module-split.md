# Atlas refactor — work module split (2026-07-08)

## Goal

Decompose the monolithic `modules/work` HTTP surface into domain route/controller packages without changing API paths or OpenAPI contracts.

## What changed

`registerWorkRoutes` is now a composition root that mounts:

| Module | Owns tags |
|--------|-----------|
| `sections` | Sections |
| `tasks` | Tasks (incl. My Work, assignees, watchers, complete/skip) |
| `labels` | Labels |
| `dependencies` | Dependencies |
| `subtasks` | Subtasks |
| `comments` | Comments |
| `attachments` | Attachments |
| `activity` | Activity |
| `notifications` | Notifications |
| `search` | Search |

Domain controllers still call the shared `WorkService` / `WorkRepository` (`createWorkService()`). Service-layer extraction is a follow-up; HTTP and controller boundaries are domain-aligned first.

## Unchanged

- All `/api/v1/...` paths
- Auth, tenancy, RBAC, outbox, projects, workspaces
- Prisma schema

## Golden paths (smoke)

1. Register → login
2. Create workspace → invite member
3. Create project → section → task
4. Assign, comment, move task across sections
5. My Work list
6. Attachment upload complete (MinIO)
7. Realtime second tab sees task create
8. Search task/project
9. Notification mark-read

## Next

1. Split `WorkService` / `WorkRepository` methods into domain services (true domain ownership).
2. Web App Router deep links (`/w/:workspaceId/projects/:projectId`).
3. Split `api-flow.test.ts` by domain.

## Follow-up: domain services (same branch)

`WorkService` is now a thin façade. Domain logic lives in:

- `sections/sections.service.ts`
- `tasks/tasks.service.ts`
- `labels/labels.service.ts`
- `dependencies/dependencies.service.ts`
- `subtasks/subtasks.service.ts`
- `comments/comments.service.ts`
- `attachments/attachments.service.ts`
- `activity/activity.service.ts`
- `notifications/notifications.service.ts`
- `search/search.service.ts`

Shared helpers:

- `work/work-domain-base.ts` — protected helpers + `getTask`
- `work/work-helpers.ts` — pure functions (search cursors, dependency map, audit payloads)
- `work/work.repository.ts` — still shared data access (repo split is next)

Controllers construct domain services via `create-work-service.ts` factories.

## Follow-up: domain repositories

`WorkRepository` is a façade. Data access lives in:

- `sections/sections.repository.ts`
- `tasks/tasks.repository.ts`
- `labels/labels.repository.ts`
- `dependencies/dependencies.repository.ts`
- `subtasks/subtasks.repository.ts`
- `comments/comments.repository.ts`
- `attachments/attachments.repository.ts`
- `activity/activity.repository.ts`
- `notifications/notifications.repository.ts`
- `search/search.repository.ts`

Shared:

- `work/work-repository-base.ts` — Prisma + `accessibleProjectWhere`
- `work/work-repository-helpers.ts` — attachment includes, search cursors
