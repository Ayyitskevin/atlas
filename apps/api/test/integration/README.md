# Integration tests

## Current

- `api-flow.test.ts` — full golden-path suite (auth → workspace → board → attachments → …).  
  Skipped when `DATABASE_URL` is unset. Run with:

```bash
pnpm test:integration
# or isolated local services:
pnpm test:integration:local
```

## Target split (follow-up)

Carve domain-focused files that share a `setup.ts` harness (app build, migrate, tokens):

| File | Coverage |
|------|----------|
| `auth.integration.test.ts` | register/login/refresh/logout |
| `workspaces.integration.test.ts` | CRUD, invites, members |
| `projects.integration.test.ts` | projects, templates, messages |
| `tasks.integration.test.ts` | sections, tasks, my-work, move/complete |
| `collaboration.integration.test.ts` | comments, labels, deps, watchers |
| `attachments.integration.test.ts` | upload/complete/download/scan |
| `notifications.integration.test.ts` | fanout + prefs |
| `search.integration.test.ts` | workspace search |

Until split lands, treat `api-flow.test.ts` as the single source of truth for golden paths.
