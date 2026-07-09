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
