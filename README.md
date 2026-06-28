# Atlas

Atlas is a team project-management platform foundation: multi-tenant Workspaces, Projects, Sections, Tasks, collaboration, notifications, search, and realtime updates.

This repository is a TypeScript monorepo with a Fastify API, Next.js web shell, shared DTO/schema package, Prisma database package, and local infrastructure for future feature work.

## Quickstart

```bash
pnpm install
pnpm dev
```

Phase 2 currently provides the monorepo scaffold and app shells. Database schema, API behavior, workers, Docker Compose, and tests are built in the following phases.

## Repository Layout

```text
apps/
  api/          # Fastify API and WebSocket gateway
  web/          # Next.js App Router shell
packages/
  config/       # Shared TypeScript, ESLint, and formatting config
  db/           # Prisma schema, migrations, seed, database client
  shared/       # Shared constants, DTOs, Zod schemas, domain types
infra/
  docker/       # Dockerfiles and local runtime config
  terraform/    # Staging-ready infrastructure modules
docs/
  architecture.md
  decisions/
```

## Documentation

- [Architecture](docs/architecture.md)
- [ADRs](docs/decisions)
