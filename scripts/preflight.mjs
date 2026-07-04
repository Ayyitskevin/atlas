import { run } from "./local-services.mjs";

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm preflight

Validates the Prisma schema, checks migration status against DATABASE_URL,
and verifies API readiness against the configured DATABASE_URL and REDIS_URL.

Set DATABASE_URL and REDIS_URL to values reachable from this process before
running against existing services. Use pnpm preflight:local for disposable
local Postgres/Redis services.
`);
  process.exit(0);
}

run("pnpm", ["--filter", "@atlas/db", "exec", "prisma", "validate", "--schema", "prisma/schema.prisma"]);
run("pnpm", ["--filter", "@atlas/db", "exec", "prisma", "migrate", "status", "--schema", "prisma/schema.prisma"]);
run("pnpm", ["--filter", "@atlas/api", "exec", "tsx", "scripts/preflight.ts"]);
