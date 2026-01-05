import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisEnabled(): boolean {
  return typeof redisUrl === "string" && redisUrl.length > 0 &&
         typeof redisToken === "string" && redisToken.length > 0;
}

export const redis = isRedisEnabled()
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;
