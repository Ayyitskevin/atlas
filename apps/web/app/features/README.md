# Web feature layout (target)

Atlas UI is migrating from a single `atlas-client.tsx` orchestrator toward feature folders:

| Folder | Responsibility |
|--------|----------------|
| `board/` | sections, board panel, project dependency map |
| `task/` | task detail, comments, attachments, labels, deps, subtasks |
| `workspace/` | dashboard, my work, search, project list |
| `notifications/` | inbox + preferences |
| `admin/` | members, invitations, outbox |

Deep links:

- `/w/[workspaceId]`
- `/w/[workspaceId]/projects/[projectId]`

Panels currently live next to `atlas-client.tsx`; move files here in a follow-up PR once import paths are updated.
