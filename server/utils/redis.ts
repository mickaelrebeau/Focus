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

// Le client attend indéfiniment la reconnexion (maxRetriesPerRequest: null) :
// sur un chemin de requête HTTP, on borne l'attente pour ne pas bloquer la réponse.
export function withRedisTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs) return promise
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Redis timeout (${timeoutMs}ms)`)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export type LockResult = 'acquired' | 'busy' | 'unavailable'

export async function tryAcquireLock(key: string, ttlMs = 30000, timeoutMs?: number): Promise<LockResult> {
  try {
    const r = useRedis()
    const result = await withRedisTimeout(r.set(`lock:${key}`, '1', 'PX', ttlMs, 'NX'), timeoutMs)
    return result === 'OK' ? 'acquired' : 'busy'
  } catch (error) {
    console.error('[redis] tryAcquireLock failed:', error)
    return 'unavailable'
  }
}

export async function acquireLock(key: string, ttlMs = 30000): Promise<boolean> {
  return (await tryAcquireLock(key, ttlMs)) === 'acquired'
}

export async function releaseLock(key: string, timeoutMs?: number): Promise<void> {
  try {
    await withRedisTimeout(redisDel(`lock:${key}`), timeoutMs)
  } catch (error) {
    console.error('[redis] releaseLock failed:', error)
  }
}
