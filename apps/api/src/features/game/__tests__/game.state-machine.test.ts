import { describe, it, expect } from 'vitest'
import {
  canTransition,
  assertTransition,
  InvalidTransitionError,
} from '../game.state-machine.js'
import type { SessionStatus } from '../game.types.js'

describe('game.state-machine', () => {
  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(canTransition('LOBBY', 'ACTIVE')).toBe(true)
      expect(canTransition('LOBBY', 'FINISHED')).toBe(true)
      expect(canTransition('ACTIVE', 'QUESTION')).toBe(true)
      expect(canTransition('ACTIVE', 'FINISHED')).toBe(true)
      expect(canTransition('QUESTION', 'REVEAL')).toBe(true)
      expect(canTransition('QUESTION', 'FINISHED')).toBe(true)
      expect(canTransition('REVEAL', 'LEADERBOARD')).toBe(true)
      expect(canTransition('REVEAL', 'FINISHED')).toBe(true)
      expect(canTransition('LEADERBOARD', 'QUESTION')).toBe(true)
      expect(canTransition('LEADERBOARD', 'FINISHED')).toBe(true)
    })

    it('should return false for invalid transitions', () => {
      expect(canTransition('LOBBY', 'QUESTION')).toBe(false)
      expect(canTransition('LOBBY', 'REVEAL')).toBe(false)
      expect(canTransition('LOBBY', 'LEADERBOARD')).toBe(false)
      expect(canTransition('ACTIVE', 'LOBBY')).toBe(false)
      expect(canTransition('ACTIVE', 'REVEAL')).toBe(false)
      expect(canTransition('QUESTION', 'LOBBY')).toBe(false)
      expect(canTransition('QUESTION', 'ACTIVE')).toBe(false)
      expect(canTransition('QUESTION', 'LEADERBOARD')).toBe(false)
      expect(canTransition('REVEAL', 'LOBBY')).toBe(false)
      expect(canTransition('REVEAL', 'QUESTION')).toBe(false)
    })

    it('should return false for any transition from FINISHED', () => {
      const statuses: SessionStatus[] = ['LOBBY', 'ACTIVE', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'FINISHED']
      for (const status of statuses) {
        expect(canTransition('FINISHED', status)).toBe(false)
      }
    })
  })

  describe('assertTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => assertTransition('LOBBY', 'ACTIVE')).not.toThrow()
      expect(() => assertTransition('QUESTION', 'REVEAL')).not.toThrow()
      expect(() => assertTransition('LEADERBOARD', 'FINISHED')).not.toThrow()
    })

    it('should throw InvalidTransitionError for invalid transitions', () => {
      expect(() => assertTransition('LOBBY', 'QUESTION')).toThrow(InvalidTransitionError)
      expect(() => assertTransition('FINISHED', 'LOBBY')).toThrow(InvalidTransitionError)
    })

    it('should include from and to in the error', () => {
      try {
        assertTransition('LOBBY', 'REVEAL')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTransitionError)
        const error = err as InvalidTransitionError
        expect(error.from).toBe('LOBBY')
        expect(error.to).toBe('REVEAL')
        expect(error.message).toContain('LOBBY')
        expect(error.message).toContain('REVEAL')
      }
    })
  })
})
