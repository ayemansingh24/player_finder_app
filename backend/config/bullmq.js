import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const parseRedisUrl = (url) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
};

export const bullmqConnection = parseRedisUrl(REDIS_URL);
export default bullmqConnection;
