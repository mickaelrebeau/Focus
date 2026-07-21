import { describe, it, expect, afterEach } from 'vitest'
import { resolveRedisUrl } from '../../server/utils/redis'

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
