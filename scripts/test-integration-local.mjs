import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const projectName = process.env.ATLAS_INTEGRATION_PROJECT || "atlas-integration";
const postgresPort = process.env.ATLAS_INTEGRATION_POSTGRES_PORT || "55432";
const redisPort = process.env.ATLAS_INTEGRATION_REDIS_PORT || "6380";
const databaseUrl = process.env.DATABASE_URL || `postgresql://atlas:atlas@localhost:${postgresPort}/atlas`;
const redisUrl = process.env.REDIS_URL || `redis://localhost:${redisPort}`;
const keepServices = process.env.ATLAS_KEEP_TEST_SERVICES === "1";

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm test:integration:local

Starts isolated Docker Compose Postgres/Redis services, runs DB-backed API
integration tests, and removes the test services afterward.

Environment:
  ATLAS_INTEGRATION_PROJECT        Compose project name. Default: ${projectName}
  ATLAS_INTEGRATION_POSTGRES_PORT  Host Postgres port. Default: ${postgresPort}
  ATLAS_INTEGRATION_REDIS_PORT     Host Redis port. Default: ${redisPort}
  DATABASE_URL                     Test database URL. Default: ${databaseUrl}
  REDIS_URL                        Test Redis URL. Default: ${redisUrl}
  ATLAS_KEEP_TEST_SERVICES=1       Leave services running after tests.
`);
  process.exit(0);
}

const composeEnv = {
  ...process.env,
  POSTGRES_HOST_PORT: postgresPort,
  REDIS_HOST_PORT: redisPort,
};

const testEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
};

let cleaningUp = false;

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  run("docker", ["compose", "version"], { env: composeEnv });
  runCompose(["down", "--volumes", "--remove-orphans"]);
  runCompose(["up", "-d", "postgres", "redis"]);
  waitForService("Postgres", ["exec", "-T", "postgres", "pg_isready", "-U", "atlas", "-d", "atlas"]);
  waitForService("Redis", ["exec", "-T", "redis", "redis-cli", "ping"]);
  run("pnpm", ["test:integration"], { env: testEnv });
} finally {
  cleanup();
}

function runCompose(args, options = {}) {
  return run("docker", ["compose", "--project-name", projectName, ...args], { env: composeEnv, ...options });
}

function waitForService(name, composeArgs) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    const result = runCompose(composeArgs, { stdio: "ignore", throwOnError: false });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error(name + " did not become ready within " + timeoutMs / 1000 + " seconds.");
}

function cleanup() {
  if (cleaningUp || keepServices) return;
  cleaningUp = true;
  runCompose(["down", "--volumes", "--remove-orphans"], { throwOnError: false });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
  });

  if (result.error) {
    if (options.throwOnError === false) return result;
    throw result.error;
  }
  if (result.status !== 0 && options.throwOnError !== false) {
    throw new Error(command + " " + args.join(" ") + " exited with " + result.status + ".");
  }
  return result;
}
