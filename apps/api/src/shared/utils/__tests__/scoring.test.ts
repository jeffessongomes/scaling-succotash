import { describe, it, expect } from 'vitest'
import { calculateScore } from '../scoring.js'

describe('calculateScore', () => {
  it('should award 100% of points when answered at 0ms', () => {
    expect(calculateScore(1000, 30000, 0)).toBe(1000)
  })

  it('should award 50% of points (minimum) when answered at exactly timeLimitMs', () => {
    expect(calculateScore(1000, 30000, 30000)).toBe(500)
  })

  it('should return 0 when answered beyond timeLimitMs', () => {
    expect(calculateScore(1000, 30000, 30001)).toBe(0)
    expect(calculateScore(1000, 30000, 60000)).toBe(0)
  })

  it('should award minimum 50% of points when answered at 50% of the time limit', () => {
    // raw = 1000 * (30000 - 15000) / 30000 = 500, which equals the minimum (500)
    expect(calculateScore(1000, 30000, 15000)).toBe(500)
  })

  it('should return 0 when pointsBase is 0', () => {
    expect(calculateScore(0, 30000, 0)).toBe(0)
    expect(calculateScore(0, 30000, 15000)).toBe(0)
  })

  it('should always return at least 50% when within time limit', () => {
    const result = calculateScore(1000, 30000, 29999)
    expect(result).toBeGreaterThanOrEqual(500)
  })

  it('should floor the result to integer', () => {
    const result = calculateScore(1000, 30000, 10001)
    expect(Number.isInteger(result)).toBe(true)
  })
})
