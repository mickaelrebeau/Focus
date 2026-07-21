import Redis from 'ioredis'

let redis: Redis | null = null

export function resolveRedisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL
  }

  try {
    const config = useRuntimeConfig()
    if (config.redisUrl) {
      return config.redisUrl
    }
  } catch {
    // Hors contexte Nitro (workers standalone)
  }

  return 'redis://localhost:6379'
}

export function useRedis() {
  if (!redis) {
    redis = new Redis(resolveRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
  }
  return redis
}

export async function redisGet(key: string): Promise<string | null> {
  const r = useRedis()
  return r.get(key)
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const r = useRedis()
  if (ttlSeconds) {
    await r.set(key, value, 'EX', ttlSeconds)
  } else {
    await r.set(key, value)
  }
}

export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
  const r = useRedis()
  const count = await r.incr(key)
  if (ttlSeconds && count === 1) {
    await r.expire(key, ttlSeconds)
  }
  return count
}

export async function redisDel(key: string): Promise<void> {
  const r = useRedis()
  await r.del(key)
}

export async function acquireLock(key: string, ttlMs = 30000): Promise<boolean> {
  try {
    const r = useRedis()
    const result = await r.set(`lock:${key}`, '1', 'PX', ttlMs, 'NX')
    return result === 'OK'
  } catch (error) {
    console.error('[redis] acquireLock failed:', error)
    return false
  }
}

export async function releaseLock(key: string): Promise<void> {
  try {
    await redisDel(`lock:${key}`)
  } catch (error) {
    console.error('[redis] releaseLock failed:', error)
  }
}
