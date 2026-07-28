import { createClient, type RedisClientType } from 'redis';
import { config } from '../config.js';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isOpen) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    const c = createClient({ url: config.REDIS_URL }) as RedisClientType;
    c.on('error', (err) => console.error('[Redis]', err.message));
    await c.connect();
    client = c;
    connecting = null;
    console.log('[Redis] Connected');
    return c;
  })();

  return connecting;
}

/** Grammy-compatible session storage backed by Redis */
export function createRedisSessionStorage<T>() {
  const prefix = 'sess:';

  return {
    async read(key: string): Promise<T | undefined> {
      try {
        const redis = await getRedis();
        const raw = await redis.get(prefix + key);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
      } catch (err) {
        console.error('[Session] read failed, falling back to empty:', err);
        return undefined;
      }
    },
    async write(key: string, value: T): Promise<void> {
      try {
        const redis = await getRedis();
        // 7 day TTL
        await redis.set(prefix + key, JSON.stringify(value), { EX: 7 * 24 * 60 * 60 });
      } catch (err) {
        console.error('[Session] write failed:', err);
      }
    },
    async delete(key: string): Promise<void> {
      try {
        const redis = await getRedis();
        await redis.del(prefix + key);
      } catch (err) {
        console.error('[Session] delete failed:', err);
      }
    },
  };
}
