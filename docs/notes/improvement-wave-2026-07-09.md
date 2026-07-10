# Atlas improvement wave — 2026-07-09

Branch: `grok/atlas-improvement-wave` (extends module-split foundation).

## Shipped in this wave

| Grade | Item | Notes |
|-------|------|--------|
| A1 | Domain module split | Already on branch; composition root + domain services/repos |
| A2 | Multi-instance realtime | Redis pub/sub on `atlas:realtime:broadcast` |
| A3 | Auth hygiene | Auth rate limits, httpOnly refresh cookie, WS first-message auth |
| A4 | Real email path | Resend seam + verification/password-reset emails; invites already wired |
| A5 | Board DnD + deep links | HTML5 drag/drop sections; App Router `/w/...` routes from prior refactor |
| B1 | OpenTelemetry | Optional OTLP bootstrap |
| B2 | Postgres FTS search | `search_vector` ranking + ILIKE fallback |
| B3 | Integration suite split | Domain slices + harness (prior) |
| B4 | Docs truth pass | architecture deferred list updated |
| B5 | Sessions + email verify + password reset | New tables + auth endpoints + Sessions UI control |
| B6 | Terraform | `compute` + `secrets` modules |
| B7 | Attachment polish | Scan-aware UI + image-ready affordance |
| B8 | Presence-lite | Task room presence join/leave |
| B9 | RBAC cache | 15s in-process permission cache |
| B10 | Comment mentions | `@email` / `@Name` → `CommentMentioned` fanout |

## Verify

```bash
corepack pnpm install
corepack pnpm --filter @atlas/db exec prisma generate
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
# with local services:
corepack pnpm migrate
corepack pnpm test:integration:local
```
