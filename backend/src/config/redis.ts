import { createClient, type RedisClientType } from 'redis';
import logger from './logger';

let client: RedisClientType | null = null;
let redisStatus: 'unknown' | 'available' | 'unavailable' = 'unknown';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

const localCache = new Map<string, CacheEntry>();

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function buildRedisOptions() {
  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL };
  }

  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT || 6379);
  const password = process.env.REDIS_PASSWORD;
  const database = Number(process.env.REDIS_DB || 0);
  const useTls = parseBoolean(process.env.REDIS_TLS) || Boolean(host && host.includes('redislabs.com'));

  if (!host) {
    return null;
  }

  const protocol = useTls ? 'rediss' : 'redis';
  const auth = password ? `:${encodeURIComponent(password)}@` : '';
  return {
    url: `${protocol}://${auth}${host}:${port}/${database}`,
    socket: {
      reconnectStrategy: false as const,
    },
  };
}

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisStatus === 'unavailable') {
    return null;
  }

  const options = buildRedisOptions();
  if (!options) {
    redisStatus = 'unavailable';
    return null;
  }

  if (!client) {
    client = createClient(options);
    client.on('error', (error: Error) => {
      if (redisStatus === 'available') {
        logger.error({ err: error }, 'Redis client error');
      }
    });
    try {
      await client.connect();
      redisStatus = 'available';
    } catch (error) {
      client = null;
      redisStatus = 'unavailable';
      return null;
    }
  }

  return client;
}

async function connectRedis(): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  await redis.ping();
  return true;
}

async function cacheJson<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    localCache.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return;
  }

  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

async function readJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClient();
  if (!redis) {
    const entry = localCache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      localCache.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  const value = await redis.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

async function removeKey(key: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    localCache.delete(key);
    return;
  }

  await redis.del(key);
}

export { getRedisClient, connectRedis, cacheJson, readJson, removeKey };