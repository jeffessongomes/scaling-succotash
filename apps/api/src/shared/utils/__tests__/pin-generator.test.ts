import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateUniquePin } from '../pin-generator.js'
import type { Redis } from 'ioredis'

const createRedisMock = (existsResults: (0 | 1)[] = [0]) => {
  let callCount = 0
  return {
    exists: vi.fn().mockImplementation(async () => {
      const result = existsResults[callCount] ?? 0
      callCount++
      return result
    }),
  } as unknown as Redis
}

describe('generateUniquePin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate a PIN with exactly 6 digits', async () => {
    const redis = createRedisMock([0])
    const pin = await generateUniquePin(redis)
    expect(pin).toMatch(/^\d{6}$/)
  })

  it('should generate a PIN without leading zeros', async () => {
    const redis = createRedisMock([0])
    const pin = await generateUniquePin(redis)
    expect(pin.charAt(0)).not.toBe('0')
  })

  it('should retry when the generated PIN already exists in Redis', async () => {
    const redis = createRedisMock([1, 1, 0])
    const pin = await generateUniquePin(redis)
    expect(redis.exists).toHaveBeenCalledTimes(3)
    expect(pin).toMatch(/^\d{6}$/)
  })

  it('should throw when all 10 attempts result in collision', async () => {
    const redis = createRedisMock(Array(10).fill(1))
    await expect(generateUniquePin(redis)).rejects.toThrow('Could not generate a unique PIN after 10 attempts')
  })

  it('should generate different PINs across multiple calls (distribution)', async () => {
    const redis = createRedisMock(Array(100).fill(0))
    const pins = new Set<string>()
    for (let i = 0; i < 100; i++) {
      pins.add(await generateUniquePin(redis))
    }
    expect(pins.size).toBeGreaterThan(90)
  })
})
