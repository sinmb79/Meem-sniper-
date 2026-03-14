import Redis from "ioredis";
import { logger } from "../utils/logger";

export class CacheService {
  private readonly redis?: Redis;
  private readonly memory = new Map<string, string>();

  constructor(redisUrl?: string) {
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1
      });
      void this.redis.connect().catch((error) => {
        logger.warn("Falling back to in-memory cache; Redis connection failed.", {
          error: String(error)
        });
      });
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.redis?.status === "ready") {
      return this.redis.get(key);
    }
    return this.memory.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.redis?.status === "ready") {
      if (ttlSeconds) {
        await this.redis.set(key, value, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, value);
      }
      return;
    }

    this.memory.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => this.memory.delete(key), ttlSeconds * 1_000).unref();
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
