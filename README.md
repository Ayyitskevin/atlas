# Atlas

Atlas is an Asana-class team project-management app foundation for organizing work across Workspaces, Projects, Sections, Tasks, comments, activity, notifications, search, attachments, and realtime collaboration.

The current phase is deliberately foundation-first: production-minded domain boundaries, tenant isolation, RBAC, auth, REST/OpenAPI contracts, background jobs, realtime delivery, local infrastructure, and a usable web workflow shell. It is not trying to be a polished project-management UI yet.

## What Works Today

- Email/password auth with JWT access tokens, refresh rotation, live session checks, logout, and session revocation.
- Multi-tenant Workspaces with member roles, invitations, role updates, member removal, and owner transfer.
- Projects with workspace/private visibility, explicit project-member roles, Sections, Tasks, one-level Subtasks, assignees, status, priority, due dates, ordering, optimistic version checks, and a cross-project My Work view.
- Workspace dashboard with project/task quick actions, project/member counts, recent notifications, activity, and assigned-work summary.
- Task comments, scoped activity feeds, in-app notifications with a web inbox, and workspace search in the web shell.
- Realtime WebSocket broadcasts for project/member/task/comment/activity mutations.
- Durable domain event outbox feeding BullMQ workers for notification fanout plus observable search-index and email-delivery provider seams.
- Workspace-admin outbox inspection/detail, dispatch attempt history, worker outcome history, and failed-event replay endpoints.
- Task attachment metadata with S3-compatible signed upload/download URLs, local MinIO support, server-side object validation before activation, explicit scan status hooks, file notes, version history, and per-file discussion threads.
- Docker Compose local stack and Terraform scaffolding for staging-oriented infrastructure.

## Stack

- Monorepo: pnpm workspaces + Turborepo
- API: Node.js, TypeScript, Fastify, REST, OpenAPI, Zod validation
- Web: Next.js App Router, TypeScript, Tailwind
- Data: PostgreSQL, Prisma, cursor pagination, soft deletes on core entities
- Jobs/cache: Redis, BullMQ
- Realtime: WebSockets
- Object storage: S3-compatible storage with MinIO locally
- Observability: pino structured logging and health/readiness endpoints
- Infra: Docker Compose locally, Terraform modules for AWS-oriented staging

## Quickstart

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker compose up
```

Then open http://localhost:3000, register a user, create a Workspace and Project, add Sections/Tasks, and open a second browser tab to see realtime updates.

To load a richer demo workspace after the database is running and migrated:

```bash
corepack pnpm seed
```

Demo login:

- Email: `kevin@example.com`
- Password: `atlas-demo-password`

The seeded `Atlas Demo Workspace` includes public and private projects, labels, watchers, pinned project messages, notification preferences, recurring work, an onboarding template, and a three-task launch dependency chain that exercises the board dependency map.

Local URLs:

- Web: http://localhost:3000
- API: http://localhost:4000
- API docs: http://localhost:4000/docs
- API readiness: http://localhost:4000/readyz
- WebSocket: ws://localhost:4000/api/v1/ws
- MinIO console: http://localhost:9001

If standard ports are already in use, override host ports without changing container networking:

```bash
POSTGRES_HOST_PORT=55432 REDIS_HOST_PORT=6380 MINIO_API_HOST_PORT=9100 MINIO_CONSOLE_HOST_PORT=9101 API_HOST_PORT=4400 WEB_HOST_PORT=3300 docker compose up
```

The `*:local` verification scripts start isolated Postgres, Redis, and MinIO services. `preflight:local` also signs, uploads, verifies metadata for, and removes a probe object. Use `ATLAS_INTEGRATION_MINIO_API_PORT` and `ATLAS_INTEGRATION_MINIO_CONSOLE_PORT` to avoid clashes with a running development stack.

Optional ClamAV scanner for local compose:

```bash
docker compose --profile scanner up clamav
ATTACHMENT_SCAN_PROVIDER=clamav CLAMAV_HOST=127.0.0.1 corepack pnpm preflight
```

## Common Commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:unit
DATABASE_URL=postgresql://atlas:atlas@localhost:5432/atlas corepack pnpm test:integration
corepack pnpm preflight
corepack pnpm preflight:local
corepack pnpm test:integration:local
corepack pnpm smoke:demo:local
corepack pnpm migrate
corepack pnpm seed
corepack pnpm cleanup:attachments
corepack pnpm cleanup:pending-uploads
corepack pnpm cleanup:deleted-attachment-objects
```

Run the API, web app, and workers in local development mode without Docker-managed app containers:

```bash
corepack pnpm dev
```

Worker note: search indexing is intentionally served by direct database queries until an external provider is chosen. Email delivery uses `EMAIL_PROVIDER=noop` by default, returning structured no-op outcomes and writing BullMQ job logs plus durable `worker_job_outcomes` rows so local operators can distinguish delivered, skipped, failed, and stubbed side effects from outbox detail. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified-domain `EMAIL_FROM` value to send through Resend.

Production note: when `NODE_ENV=production`, Atlas refuses to start with local JWT placeholders, secrets shorter than 32 characters, or matching access/refresh secrets. Generate unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` before deploying.

Attachment cleanup note: `pnpm cleanup:attachments` defaults to a dry run and reports both abandoned pending uploads and retained deleted attachment objects. This is the command to schedule in production, and it must be re-run with `-- --confirm` to mutate rows or delete S3-compatible objects.

Pending upload cleanup note: `pnpm cleanup:pending-uploads` defaults to a dry run and reports pending initial uploads/replacement versions older than 24 hours. Re-run with `-- --confirm` to expire those DB rows and delete their S3-compatible objects; set `ATLAS_PENDING_UPLOAD_TTL_HOURS` to use a different expiry window.

Deleted attachment retention note: `pnpm cleanup:deleted-attachment-objects` defaults to a dry run and reports retained S3-compatible objects for soft-deleted attachments older than 30 days. Re-run with `-- --confirm` to delete those objects and mark their metadata with `object_deleted_at`; set `ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS` to use a different retention window.

Attachment scan note: `ATTACHMENT_SCAN_PROVIDER=noop` is the default and records a durable `SKIPPED` scan status. Set `ATTACHMENT_SCAN_PROVIDER=clamav` with `CLAMAV_HOST`, `CLAMAV_PORT`, and `CLAMAV_TIMEOUT_MS` to stream completed upload objects to clamd before activation. Clean objects are published; infected or unverifiable objects stay unpublished with `INFECTED` or `ERROR` scan state. `pnpm preflight` reports `attachmentScanner: "skipped"` for the noop provider and requires a successful clamd `PING` when the ClamAV provider is enabled.

When using the Docker Compose app containers with the scanner profile, set `CLAMAV_HOST=clamav` for the API container; when running the API or `pnpm preflight` directly on the host against the exposed compose service, use `CLAMAV_HOST=127.0.0.1`.

Run the dockerized E2E smoke test against a running API container:

```bash
ATLAS_E2E_DOCKER=1 ATLAS_E2E_BASE_URL=http://localhost:4000 corepack pnpm test:e2e
```

API integration tests require `DATABASE_URL` to point at a reachable PostgreSQL database. When `DATABASE_URL` is unset, `pnpm test` still runs the DB-free unit and web suites and reports the integration flow as skipped. Use `pnpm test:integration` when you want the DB-backed flow to be mandatory; use `pnpm test:integration:local` to run the DB-backed suite against isolated Postgres/Redis services. Use `pnpm preflight` to validate the Prisma schema, check migration status, verify `/readyz` against the configured `DATABASE_URL` and `REDIS_URL`, verify S3-compatible signed upload/download instruction generation plus object writes, and verify clamd reachability when `ATTACHMENT_SCAN_PROVIDER=clamav`; use `pnpm preflight:local` for the same default checks against disposable local Postgres/Redis/MinIO services. Use `pnpm smoke:demo:local` to apply migrations, seed the demo workspace, log in with the documented demo account, and verify the launch-critical demo surfaces through the API. The local harness uses Docker Compose when available and falls back to direct Podman containers on Podman hosts without a Compose provider. GitHub Actions runs `pnpm test:unit` and `pnpm test:integration` separately.

## Repository Layout

```text
apps/
  api/          # Fastify REST API, WebSocket gateway, workers
  web/          # Next.js App Router shell
packages/
  config/       # Shared TypeScript config
  db/           # Prisma schema, migrations, seed, database client
  shared/       # Shared constants, DTOs, Zod schemas, domain types
infra/
  docker/       # Dockerfiles
  terraform/    # Staging-ready infrastructure modules
docs/
  architecture.md
  decisions/
  notes/
```

## Documentation

- [Architecture](docs/architecture.md)
- [ADRs](docs/decisions)
- [Notes](docs/notes)

## Verification

The expected baseline before pushing is:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm test:integration
```

GitHub Actions also runs Prisma generation, lint, typecheck, build, unit tests, DB-backed integration tests, migration diff checks, and a Docker Compose API smoke test on pushes to `main` and pull requests.

## Project Direction

Atlas should continue to grow in vertical slices: keep service-layer permission guards, strict workspace scoping, OpenAPI/Zod contracts, integration coverage, and Docker-first local reproducibility intact as new project-management features are added.
