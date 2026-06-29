# Atlas Nightly Log - 2026-06-28

Logged: 2026-06-28 22:04 EDT

## Summary

Atlas foundation work advanced through seven slices and is pushed to `main`.

- Standardized Fastify/OpenAPI route schemas and Atlas error responses.
- Hardened auth session handling, refresh rotation, replay detection, and session revocation.
- Added workspace invitation lifecycle, role updates, member removal, and owner transfer.
- Added a usable Next.js workflow shell for registration/login, workspace/project/section/task/comment flows, and realtime status.
- Added a durable domain event outbox dispatcher for notification/search/email side effects.
- Added task attachment metadata, S3-compatible signed upload/download URLs, MinIO bucket bootstrap, and integration coverage.
- Fixed Docker API image generation so Prisma Client exists in compose containers.
- Fixed GitHub Actions warning by updating `pnpm/action-setup` from `v4` to `v6`.

## Pushed Commits

- `49cdf7a` - `fix(ci): update pnpm setup action`
- `d6d34dc` - `fix(infra): generate prisma client in api image`
- `b53d79f` - `feat(attachments): add task attachment metadata`
- `b93db2a` - `feat(events): add durable outbox dispatcher`
- `a4bd666` - `feat(web): add usable project workflow`
- `cef2b45` - `feat(workspaces): add invitation lifecycle`
- `497cedb` - `fix(auth): harden refresh rotation and sessions`
- `5d037c6` - `fix(api): standardize route contract schemas`

## Verification

- Local `corepack pnpm lint` passed.
- Local `corepack pnpm typecheck` passed.
- Local `corepack pnpm test` passed with API unit/integration coverage.
- Opt-in Docker smoke passed against an isolated compose project on `localhost:4000`.
- GitHub Actions CI passed on `49cdf7a`.
- CI deprecation annotation for `pnpm/action-setup@v4` is gone after moving to `v6`.

## Notes For Next Session

- Current branch state: `main` is synced with `origin/main`.
- Docker compose path now generates Prisma Client during image build.
- Docker smoke remains opt-in via `ATLAS_E2E_DOCKER=1`; consider wiring it into CI later if runtime cost is acceptable.
- Frontend is intentionally a workflow shell, not polished project-management UI.
- Outbox dispatcher is durable enough for MVP but still lacks admin replay tooling and deeper dead-letter inspection.

## Security

No tokens, OAuth credentials, private key material, one-time device codes, or secrets were recorded.
