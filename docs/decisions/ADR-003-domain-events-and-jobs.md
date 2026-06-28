# ADR-003: Domain Events And Jobs

## Status

Accepted

## Context

Task updates, comments, assignments, notifications, activity logs, realtime broadcasts, and search indexing should not be tightly coupled inside route handlers.

## Decision

Atlas mutations emit domain events from services. Durable activity events are written transactionally when required. Side effects such as notification fanout, search indexing, and email delivery are processed through BullMQ workers.

Event payloads include:

- `eventId`
- `eventType`
- `workspaceId`
- relevant entity ids
- actor user id
- timestamp
- version

Workers use retry policies and dead-letter queues. Event consumers must be idempotent by `eventId`.

## Rationale

The event model gives Atlas an auditable mutation trail and lets notifications, realtime broadcasts, and indexing evolve independently. BullMQ is a pragmatic choice with Redis already required for caching/rate limiting/session-adjacent infrastructure.

## Consequences

- Mutation services must produce events consistently.
- Tests need to verify both state changes and emitted events for critical paths.
- Some read models, especially search and notifications, are eventually consistent.
- Dead-letter inspection and replay tooling are deferred but the queue topology must support them from day one.
