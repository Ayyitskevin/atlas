import { Redis } from "ioredis";

import { env } from "../config/env.js";

let shared: Redis | null = null;

export function getRealtimeRedis(): Redis {
  if (!shared) {
    shared = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }
  return shared;
}

export async function closeRealtimeRedis(): Promise<void> {
  if (!shared) return;
  await shared.quit().catch(() => undefined);
  shared = null;
}
