import { localIntegrationConfig, localIntegrationEnvironmentHelp, withLocalIntegrationServices } from "./local-services.mjs";

const config = localIntegrationConfig();

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm preflight:local

Starts isolated Postgres/Redis services, applies migrations, runs the standard
Atlas preflight checks against those services, and removes the services
afterward.

${localIntegrationEnvironmentHelp(config)}
`);
  process.exit(0);
}

await withLocalIntegrationServices(({ env, run }) => {
  run("pnpm", ["--filter", "@atlas/db", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { env });
  run("pnpm", ["preflight"], { env });
});
