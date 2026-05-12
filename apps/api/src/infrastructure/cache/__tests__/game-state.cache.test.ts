import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GameSessionState } from '../../../features/game/game.types.js'

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    hsetnx: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    zadd: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: mockRedis,
}))

const {
  saveSession,
  getSession,
  deleteSession,
  saveAnswer,
  updateScore,
  getAnswers,
} = await import('../game-state.cache.js')

const createSession = (overrides?: Partial<GameSessionState>): GameSessionState => ({
  sessionId: 'session-abc',
  pin: '123456',
  quizId: 'quiz-xyz',
  hostSocketId: 'socket-host-1',
  status: 'LOBBY',
  currentQuestionIndex: 0,
  questionStartedAt: null,
  hostDisconnectedAt: null,
  participants: {},
  ...overrides,
})

describe('game-state.cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveSession', () => {
    it('should serialize session to JSON and SET with TTL', async () => {
      const session = createSession()
      await saveSession(session)
      expect(mockRedis.set).toHaveBeenCalledOnce()
      const [key, value, exFlag, ttl] = mockRedis.set.mock.calls[0] as [string, string, string, number]
      expect(key).toBe('game:session:123456')
      expect(JSON.parse(value)).toEqual(session)
      expect(exFlag).toBe('EX')
      expect(typeof ttl).toBe('number')
      expect(ttl).toBeGreaterThan(0)
    })
  })

  describe('getSession', () => {
    it('should deserialize JSON to GameSessionState', async () => {
      const session = createSession()
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(session))
      const result = await getSession('123456')
      expect(result).toEqual(session)
    })

    it('should return null when session does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null)
      const result = await getSession('999999')
      expect(result).toBeNull()
    })
  })

  describe('deleteSession', () => {
    it('should delete all keys for the session', async () => {
      await deleteSession('123456')
      expect(mockRedis.del).toHaveBeenCalledOnce()
      const keys = mockRedis.del.mock.calls[0] as string[]
      expect(keys).toContain('game:session:123456')
    })
  })

  describe('saveAnswer', () => {
    it('should serialize optionId and answeredInMs as "optionId:answeredInMs" in HSETNX', async () => {
      mockRedis.hsetnx.mockResolvedValueOnce(1)
      const result = await saveAnswer('123456', 'question-1', 'participant-1', 'opt-correct', 5000)
      expect(result).toBe(true)
      expect(mockRedis.hsetnx).toHaveBeenCalledWith(
        'game:answers:123456:question-1',
        'participant-1',
        'opt-correct:5000',
      )
    })

    it('should return false for duplicate answer (HSETNX returns 0)', async () => {
      mockRedis.hsetnx.mockResolvedValueOnce(0)
      const result = await saveAnswer('123456', 'question-1', 'participant-1', 'opt-correct', 5000)
      expect(result).toBe(false)
    })
  })

  describe('getAnswers', () => {
    it('should parse "opt-correct:5000" to { optionId, answeredInMs }', async () => {
      mockRedis.hgetall.mockResolvedValueOnce({ 'participant-1': 'opt-correct:5000' })
      const result = await getAnswers('123456', 'question-1')
      expect(result).toEqual({
        'participant-1': { optionId: 'opt-correct', answeredInMs: 5000 },
      })
    })

    it('should return empty object when hash is empty', async () => {
      mockRedis.hgetall.mockResolvedValueOnce({})
      const result = await getAnswers('123456', 'question-1')
      expect(result).toEqual({})
    })

    it('should parse multiple participants correctly', async () => {
      mockRedis.hgetall.mockResolvedValueOnce({
        'participant-1': 'opt-correct:5000',
        'participant-2': 'opt-wrong:12000',
      })
      const result = await getAnswers('123456', 'question-1')
      expect(result).toEqual({
        'participant-1': { optionId: 'opt-correct', answeredInMs: 5000 },
        'participant-2': { optionId: 'opt-wrong', answeredInMs: 12000 },
      })
    })
  })

  describe('updateScore', () => {
    it('should ZADD the score for a participant', async () => {
      await updateScore('123456', 'participant-1', 750)
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'game:scores:123456',
        750,
        'participant-1',
      )
    })
  })
})
