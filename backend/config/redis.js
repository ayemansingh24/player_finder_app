import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient = null;
let isRedisConnected = false;

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000);
      return delay;
    },
    lazyConnect: true,
  });

  redisClient.on("connect", () => {
    isRedisConnected = true;
    console.log("✅ Redis connected successfully");
  });

  redisClient.on("error", (err) => {
    isRedisConnected = false;
    // Log as warning to avoid noisy uncaught exception crashes during dev/offline mode
    console.warn("⚠️ Redis client warning/error:", err.message);
  });

  // Attempt initial non-blocking connection
  redisClient.connect().catch((err) => {
    console.warn("⚠️ Redis initial connect failed (will retry in background):", err.message);
  });
} catch (error) {
  console.warn("⚠️ Failed to initialize Redis client:", error.message);
}

export const getRedisClient = () => redisClient;
export const isRedisReady = () => isRedisConnected;
export { redisClient };
export default redisClient;
