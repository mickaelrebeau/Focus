import { describe, it, expect, afterEach, vi } from 'vitest'
import { resolveRedisUrl, withRedisTimeout } from '../../server/utils/redis'

describe('resolveRedisUrl', () => {
  const originalRedisUrl = process.env.REDIS_URL

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalRedisUrl
    }
  })

  it('reads REDIS_URL from process.env outside Nitro context', () => {
    process.env.REDIS_URL = 'redis://worker-test:6379'
    expect(resolveRedisUrl()).toBe('redis://worker-test:6379')
  })
})

describe('withRedisTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renvoie le résultat si Redis répond à temps', async () => {
    await expect(withRedisTimeout(Promise.resolve('OK'), 500)).resolves.toBe('OK')
  })

  it('échoue si Redis ne répond pas dans le délai', async () => {
    vi.useFakeTimers()
    const pending = withRedisTimeout(new Promise(() => {}), 500)
    vi.advanceTimersByTime(500)
    await expect(pending).rejects.toThrow('Redis timeout (500ms)')
  })

  it('ne borne pas l’attente sans délai', async () => {
    const promise = Promise.resolve('OK')
    expect(withRedisTimeout(promise)).toBe(promise)
  })
})
