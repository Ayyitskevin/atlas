# ADR-001: Platform Stack

## Status

Accepted

## Context

Atlas needs a production-grade foundation for a multi-tenant project-management product. The immediate goal is a safe platform layer, not a feature-complete UI.

## Decision

- Monorepo: pnpm workspaces with Turborepo-compatible scripts.
- Backend: Node.js, TypeScript, Fastify.
- API: REST first with generated OpenAPI.
- Database: PostgreSQL with Prisma.
- Cache and queues: Redis with BullMQ.
- Auth: email/password first; OAuth account table from day one.
- Realtime: WebSockets.
- Search: PostgreSQL full-text through a `SearchService` abstraction.
- Storage: S3-compatible object storage; MinIO locally.
- Frontend scaffold: Next.js App Router, TypeScript, Tailwind, shadcn/ui-ready structure.
- Observability: pino structured logging and OpenTelemetry hooks.

## Rationale

Fastify keeps the API layer small and explicit. It fits the requested route-controller-service-repository structure without the extra abstraction weight of NestJS.

Prisma is selected over Drizzle because its schema and migration workflow are easier to read for a foundation repo with many relational entities. The project will still keep repositories thin so a future ORM change is possible.

WebSockets are selected over SSE because Atlas will need explicit room subscriptions, task-level updates, comments, and presence-lite behavior.

Postgres full-text search keeps the MVP simple while the `SearchService` interface protects the domain from a future OpenSearch/Elasticsearch migration.

## Consequences

- Service boundaries must stay strict so Fastify route files do not absorb business logic.
- Prisma schema changes must be migration-reviewed in CI.
- WebSocket authorization must reuse service permission checks, not separate ad hoc logic.
- Search indexing becomes eventually consistent through jobs.
