import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { startOpenTelemetry } from "./observability/otel.js";
import { closeRealtimeRedis, getRealtimeRedis } from "./realtime/redis-client.js";
import { realtimeHub } from "./realtime/realtime.hub.js";

await startOpenTelemetry();

const app = await buildApp();

try {
  let redisOk = false;
  try {
    const redis = getRealtimeRedis();
    if (redis.status !== "ready") {
      await redis.connect();
    }
    redisOk = redis.status === "ready";
  } catch {
    redisOk = false;
  }

  if (redisOk) {
    await realtimeHub.start(getRealtimeRedis());
    app.log.info("realtime hub started with Redis pub/sub");
  } else {
    await realtimeHub.start(null);
    app.log.warn("realtime hub started in local-only mode (Redis unavailable)");
  }

  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error({ error }, "failed to start Atlas API");
  await realtimeHub.stop();
  await closeRealtimeRedis();
  process.exit(1);
}

const shutdown = async () => {
  await app.close().catch(() => undefined);
  await realtimeHub.stop();
  await closeRealtimeRedis();
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
