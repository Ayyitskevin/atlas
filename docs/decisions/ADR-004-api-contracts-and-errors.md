# ADR-004: API Contracts And Errors

## Status

Accepted

## Context

Atlas needs stable REST APIs today while leaving room for GraphQL later. The API must validate inputs consistently and expose predictable errors to web, worker, and future client integrations.

## Decision

REST endpoints live under `/api/v1`. Request and response DTOs are defined with Zod in `packages/shared`, reused by Fastify route schemas, and emitted into OpenAPI.

All list endpoints use cursor pagination. All errors use the Atlas error envelope:

```json
{
  "error": {
    "code": "ATLAS_FORBIDDEN",
    "message": "You do not have permission to perform this action.",
    "requestId": "req_...",
    "details": {}
  }
}
```

Error codes are prefixed with `ATLAS_`.

## Rationale

Zod keeps runtime validation close to TypeScript DTOs. A consistent error envelope makes frontend handling, tests, and logs predictable. Cursor pagination prevents early offset-pagination coupling for activity, notifications, comments, and tasks.

## Consequences

- DTOs must stay separate from Prisma entities.
- Route handlers should translate transport inputs into service DTOs and never return raw database models.
- OpenAPI generation becomes part of CI validation.
