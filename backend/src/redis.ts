import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => {
  // Gracefully handle redis errors during dev if redis is not installed
  if (process.env.NODE_ENV !== "production") {
    // Silent in dev unless you want to debug redis
  } else {
    console.error("Redis Error:", err);
  }
});
