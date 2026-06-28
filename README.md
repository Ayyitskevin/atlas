# Atlas

Atlas is a team project-management platform foundation: multi-tenant Workspaces, Projects, Sections, Tasks, comments, notifications, search, background jobs, and realtime task/comment updates.

This repository is a TypeScript monorepo with a Fastify API, Next.js App Router web shell, shared DTO/schema package, Prisma database package, Redis/BullMQ workers, Docker Compose local infrastructure, and Terraform scaffolding for staging.

## Quickstart

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker compose up
```

Local URLs:

- Web: http://localhost:3000
- API: http://localhost:4000
- API docs: http://localhost:4000/docs
- WebSocket: ws://localhost:4000/api/v1/ws
- MinIO console: http://localhost:9001

If standard ports are already in use, override host ports without changing container networking:

```bash
POSTGRES_HOST_PORT=55432 REDIS_HOST_PORT=6380 MINIO_API_HOST_PORT=9100 MINIO_CONSOLE_HOST_PORT=9101 API_HOST_PORT=4400 WEB_HOST_PORT=3300 docker compose up
```

## Common Commands

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm migrate
corepack pnpm seed
```

Run the dockerized E2E smoke test against a running API container:

```bash
ATLAS_E2E_DOCKER=1 ATLAS_E2E_BASE_URL=http://localhost:4000 corepack pnpm --filter @atlas/api exec vitest run test/e2e
```

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
```

## Documentation

- [Architecture](docs/architecture.md)
- [ADRs](docs/decisions)
