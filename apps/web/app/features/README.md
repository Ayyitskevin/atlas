# Web features

Atlas UI is organized by product surface:

| Folder | Responsibility |
|--------|----------------|
| `shared/` | API client, types, formatters, realtime, upload utils |
| `board/` | Project list, kanban board, dependency map, project work hook |
| `task/` | Task detail and sub-panels (assignees, comments, attachments, …) |
| `workspace/` | Home dashboard, My Work, search, admin, messages, templates |
| `notifications/` | Inbox + preference hooks |
| `admin/` | Outbox, invite acceptance |

Shell navigation in `atlas-client.tsx` switches **Home · Board · Inbox · Admin** so operators are not flooded with every panel at once.
