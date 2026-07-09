# Integration tests

## Current

| File | Coverage |
|------|----------|
| `api-flow.test.ts` | Full golden path (auth → workspace → board → attachments → …) |
| `auth.integration.test.ts` | register / me / login / refresh / logout |
| `workspaces.integration.test.ts` | create / list / detail / members / rename |
| `tasks.integration.test.ts` | sections, tasks, my-work, move, complete, comment |
| `helpers/app-harness.ts` | Shared migrate + `buildApp` lifecycle |

Skipped when `DATABASE_URL` is unset.

```bash
pnpm test:integration
pnpm test:integration:local
```

## Target split (remaining)

Carve more domain files that use `helpers/app-harness.ts`:

| File | Coverage |
|------|----------|
| `projects.integration.test.ts` | projects, templates, messages |
| `collaboration.integration.test.ts` | comments, labels, deps, watchers |
| `attachments.integration.test.ts` | upload/complete/download/scan |
| `notifications.integration.test.ts` | fanout + prefs |
| `search.integration.test.ts` | workspace search |

Until those land, `api-flow.test.ts` remains the single full golden-path source of truth.
