import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const projectName = process.env.ATLAS_INTEGRATION_PROJECT || "atlas-integration";
const postgresPort = process.env.ATLAS_INTEGRATION_POSTGRES_PORT || "55432";
const redisPort = process.env.ATLAS_INTEGRATION_REDIS_PORT || "6380";
const databaseUrl = process.env.DATABASE_URL || `postgresql://atlas:atlas@localhost:${postgresPort}/atlas`;
const redisUrl = process.env.REDIS_URL || `redis://localhost:${redisPort}`;
const keepServices = process.env.ATLAS_KEEP_TEST_SERVICES === "1";
const requestedDriver = process.env.ATLAS_INTEGRATION_DRIVER || "auto";

if (process.argv.includes("--help")) {
  console.log(`Usage: pnpm test:integration:local

Starts isolated Postgres/Redis services, runs DB-backed API integration tests,
and removes the test services afterward.

Environment:
  ATLAS_INTEGRATION_PROJECT        Compose project name. Default: ${projectName}
  ATLAS_INTEGRATION_POSTGRES_PORT  Host Postgres port. Default: ${postgresPort}
  ATLAS_INTEGRATION_REDIS_PORT     Host Redis port. Default: ${redisPort}
  ATLAS_INTEGRATION_DRIVER         auto, compose, or podman. Default: ${requestedDriver}
  DATABASE_URL                     Test database URL. Default: ${databaseUrl}
  REDIS_URL                        Test Redis URL. Default: ${redisUrl}
  ATLAS_KEEP_TEST_SERVICES=1       Leave services running after tests.
`);
  process.exit(0);
}

if (!["auto", "compose", "podman"].includes(requestedDriver)) {
  throw new Error("ATLAS_INTEGRATION_DRIVER must be auto, compose, or podman.");
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
let serviceDriver;

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  serviceDriver = selectServiceDriver();
  console.log("Starting integration services with " + serviceDriver.name + ".");
  serviceDriver.cleanup();
  serviceDriver.start();
  waitForService("Postgres", () => serviceDriver.checkPostgres());
  waitForService("Redis", () => serviceDriver.checkRedis());
  run("pnpm", ["test:integration"], { env: testEnv });
} finally {
  cleanup();
}

function selectServiceDriver() {
  if (requestedDriver === "auto" || requestedDriver === "compose") {
    const composeCheck = run("docker", ["compose", "version"], { env: composeEnv, stdio: "ignore", throwOnError: false });
    if (composeCheck.status === 0) return dockerComposeDriver();
    if (requestedDriver === "compose") throw driverError("Docker Compose", composeCheck);
  }

  if (requestedDriver === "auto" || requestedDriver === "podman") {
    const podmanCheck = run("podman", ["info"], { stdio: "ignore", throwOnError: false });
    if (podmanCheck.status === 0) return podmanDriver();
    if (requestedDriver === "podman") throw driverError("Podman", podmanCheck);
  }

  throw new Error(
    "No supported local integration service driver found. Install Docker with Compose, or install Podman. " +
      "Set ATLAS_INTEGRATION_DRIVER=compose or ATLAS_INTEGRATION_DRIVER=podman to force a driver.",
  );
}

function dockerComposeDriver() {
  return {
    checkPostgres: () => runCompose(["exec", "-T", "postgres", "pg_isready", "-U", "atlas", "-d", "atlas"], { stdio: "ignore", throwOnError: false }),
    checkRedis: () => runCompose(["exec", "-T", "redis", "redis-cli", "ping"], { stdio: "ignore", throwOnError: false }),
    cleanup: () => runCompose(["down", "--volumes", "--remove-orphans"], { throwOnError: false }),
    name: "Docker Compose",
    start: () => runCompose(["up", "-d", "postgres", "redis"]),
  };
}

function runCompose(args, options = {}) {
  return run("docker", ["compose", "--project-name", projectName, ...args], { env: composeEnv, ...options });
}

function podmanDriver() {
  const resourcePrefix = projectName.replace(/[^a-zA-Z0-9_.-]/g, "-") || "atlas-integration";
  const postgresContainer = resourcePrefix + "-postgres";
  const redisContainer = resourcePrefix + "-redis";
  const postgresVolume = resourcePrefix + "-postgres-data";
  const redisVolume = resourcePrefix + "-redis-data";

  return {
    checkPostgres: () => run("podman", ["exec", postgresContainer, "pg_isready", "-U", "atlas", "-d", "atlas"], { stdio: "ignore", throwOnError: false }),
    checkRedis: () => run("podman", ["exec", redisContainer, "redis-cli", "ping"], { stdio: "ignore", throwOnError: false }),
    cleanup: () => {
      run("podman", ["rm", "--force", "--volumes", postgresContainer, redisContainer], { throwOnError: false });
      run("podman", ["volume", "rm", "--force", postgresVolume, redisVolume], { throwOnError: false });
    },
    name: "Podman",
    start: () => {
      run("podman", [
        "run",
        "--detach",
        "--name",
        postgresContainer,
        "--env",
        "POSTGRES_DB=atlas",
        "--env",
        "POSTGRES_PASSWORD=atlas",
        "--env",
        "POSTGRES_USER=atlas",
        "--publish",
        postgresPort + ":5432",
        "--volume",
        postgresVolume + ":/var/lib/postgresql/data",
        "docker.io/library/postgres:17-alpine",
      ]);
      run("podman", [
        "run",
        "--detach",
        "--name",
        redisContainer,
        "--publish",
        redisPort + ":6379",
        "--volume",
        redisVolume + ":/data",
        "docker.io/library/redis:7-alpine",
        "redis-server",
        "--appendonly",
        "yes",
      ]);
    },
  };
}

function waitForService(name, checkService) {
  const startedAt = Date.now();
  const timeoutMs = 60_000;

  while (Date.now() - startedAt < timeoutMs) {
    const result = checkService();
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  throw new Error(name + " did not become ready within " + timeoutMs / 1000 + " seconds.");
}

function cleanup() {
  if (cleaningUp || keepServices || !serviceDriver) return;
  cleaningUp = true;
  serviceDriver.cleanup();
}

function driverError(name, result) {
  const detail = result.error ? result.error.message : "exit code " + result.status;
  return new Error(name + " is not usable by this session: " + detail);
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
