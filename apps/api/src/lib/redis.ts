import Redis from "ioredis";
import { logger } from "./logger";

export const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export function redisTarget(url = redisUrl): { host: string; port: string; db: string } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "6379",
      db: parsed.pathname.replace("/", "") || "0",
    };
  } catch {
    return { host: "invalid", port: "", db: "" };
  }
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  connectTimeout: 10_000,
  family: 4,
});

redis.on("connect", () => {
  logger.info("redis_connected", redisTarget());
});

redis.on("error", (err) => {
  logger.error("redis_error", { message: err.message, ...redisTarget() });
});

export async function assertRedis(): Promise<void> {
  const pong = await redis.ping();
  logger.info("redis_ping", { pong, ...redisTarget() });
}
