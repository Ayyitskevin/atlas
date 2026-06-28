# ADR-002: Tenancy And RBAC

## Status

Accepted

## Context

Atlas is multi-tenant. Users can belong to multiple workspaces, and private projects must remain isolated from workspace members without explicit access.

## Decision

Workspace isolation is enforced in the service and repository layers using explicit `workspaceId` scope on all tenant data. Workspace roles define baseline permissions, and project roles refine access for project operations.

Workspace roles:

- `OWNER`
- `ADMIN`
- `MEMBER`
- `GUEST`

Project roles:

- `PROJECT_ADMIN`
- `EDITOR`
- `COMMENTER`
- `VIEWER`

Every public service method starts with a permission guard. API routes do not own authorization decisions.

## Rationale

Application-layer tenancy keeps the first implementation straightforward and testable. Requiring `workspaceId` in service inputs prevents accidental global queries. Project roles are necessary because workspace-visible and private projects have different access semantics.

## Consequences

- Repositories must not provide unscoped tenant list methods.
- Permission checks need focused unit tests before feature work expands.
- Background jobs must include `workspaceId` and re-check entity scope before side effects.
- PostgreSQL row-level security remains a future hardening step, not an MVP dependency.
