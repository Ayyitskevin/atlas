# Atlas golden paths

Release-blocking user journeys. Keep green across refactors.

1. **Auth** — register, login, refresh, logout, `/auth/me`
2. **Workspace** — create, list, invite, accept invite, role change
3. **Project** — create public project, list, archive
4. **Board** — create sections, reorder, create tasks, move task, complete task
5. **My Work** — assigned tasks across projects with filters
6. **Collaboration** — comment, watchers, labels, dependencies
7. **Attachments** — signed upload, complete, download, version replace
8. **Realtime** — second client receives task/comment events
9. **Notifications** — receive fanout, mark one/all read, preferences
10. **Search** — find task and project by title fragment
11. **Admin** — outbox list/detail for workspace admin (if seeded failures)

Commands:

```bash
corepack pnpm preflight:local
corepack pnpm test:unit
corepack pnpm test:integration:local
corepack pnpm smoke:demo:local
```
