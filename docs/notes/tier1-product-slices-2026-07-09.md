# Tier 1 product slices — 2026-07-09

## Shipped

### #1 Auth completion UX
- Auth panel modes: login, register, forgot password, reset password
- Verify-email CTA when `verifyToken` is present
- Unverified banner + resend verification while logged in
- `User.emailVerifiedAt` on the web type + `/auth/me`

### #2 Email dogfood
- `docs/email-dogfood.md` — Resend setup, DNS checklist, multi-user golden path, local noop path
- Linked from README

### #3 Board UX depth
- Optimistic task move with conflict rollback + reload
- Filters: status, priority, assignee (plus existing dependency filter)
- Bulk select → complete / move
- Keyboard: `j`/`k` select, `c` complete, `n` focus new task

### #4 Notification product
- Inbox “Open task” fetches task by id, switches project, opens detail
- Marks notification read on open
- Unread badge + copy; email preference help text
- Load up to 50 notifications per filter

## Verify

```bash
corepack pnpm --filter @atlas/web typecheck
corepack pnpm --filter @atlas/web test:unit
corepack pnpm --filter @atlas/web lint
```
