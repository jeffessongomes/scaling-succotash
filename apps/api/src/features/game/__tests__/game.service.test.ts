import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GameSessionState } from '../game.types.js'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    quiz: {
      findUnique: vi.fn(),
    },
    gameSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    gameParticipant: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    gameAnswer: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const { mockCache } = vi.hoisted(() => ({
  mockCache: {
    saveSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getAnswers: vi.fn().mockResolvedValue({}),
  },
}))

const { mockPinGenerator } = vi.hoisted(() => ({
  mockPinGenerator: {
    generateUniquePin: vi.fn().mockResolvedValue('482971'),
  },
}))

vi.mock('../../../config/database.js', () => ({ prisma: mockPrisma }))
vi.mock('../../../infrastructure/cache/game-state.cache.js', () => mockCache)
vi.mock('../../../shared/utils/pin-generator.js', () => mockPinGenerator)

const { createSession, getSessionByPin, finalizeSession } = await import('../game.service.js')

const createQuiz = () => ({
  id: 'quiz-abc',
  title: 'Capitais do Brasil',
  isPublished: true,
  questions: [
    {
      id: 'q-1',
      text: 'Capital do Brasil?',
      timeLimitSecs: 30,
      points: 1000,
      options: [
        { id: 'opt-1', text: 'Brasília', isCorrect: true, color: 'GREEN', order: 1 },
        { id: 'opt-2', text: 'São Paulo', isCorrect: false, color: 'RED', order: 2 },
      ],
      mediaType: null,
      mediaUrl: null,
      order: 1,
    },
  ],
})

describe('game.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('should generate a unique PIN, save to PostgreSQL and Redis', async () => {
      const quiz = createQuiz()
      mockPrisma.quiz.findUnique.mockResolvedValueOnce(quiz)
      mockPrisma.gameSession.findFirst.mockResolvedValueOnce(null)
      mockPrisma.gameSession.create.mockResolvedValueOnce({
        id: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        quizId: quiz.id,
        quiz: { title: quiz.title, questions: quiz.questions },
      })

      const result = await createSession({ quizId: 'quiz-abc' }, 'user-teacher', 'socket-host-1')

      expect(mockPinGenerator.generateUniquePin).toHaveBeenCalledOnce()
      expect(mockPrisma.gameSession.create).toHaveBeenCalledOnce()
      expect(mockCache.saveSession).toHaveBeenCalledOnce()
      expect(result.pin).toBe('482971')
      expect(result.status).toBe('LOBBY')
    })

    it('should throw when quiz is not published', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValueOnce({ ...createQuiz(), isPublished: false })
      await expect(createSession({ quizId: 'quiz-abc' }, 'user-teacher', 'socket-host-1')).rejects.toThrow()
    })

    it('should throw when quiz does not exist', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValueOnce(null)
      await expect(createSession({ quizId: 'quiz-abc' }, 'user-teacher', 'socket-host-1')).rejects.toThrow()
    })

    it('should throw when there is already an active session for the quiz', async () => {
      mockPrisma.quiz.findUnique.mockResolvedValueOnce(createQuiz())
      mockPrisma.gameSession.findFirst.mockResolvedValueOnce({ id: 'existing-session' })
      await expect(createSession({ quizId: 'quiz-abc' }, 'user-teacher', 'socket-host-1')).rejects.toThrow()
    })
  })

  describe('getSessionByPin', () => {
    it('should return session from Redis cache first', async () => {
      const session: GameSessionState = {
        sessionId: 'session-abc',
        pin: '482971',
        quizId: 'quiz-abc',
        hostSocketId: 'socket-host-1',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        questionStartedAt: null,
        hostDisconnectedAt: null,
        participants: {},
      }
      mockCache.getSession.mockResolvedValueOnce(session)
      const result = await getSessionByPin('482971')
      expect(result).toEqual(session)
      expect(mockPrisma.gameSession.findUnique).not.toHaveBeenCalled()
    })

    it('should fallback to PostgreSQL when not in Redis', async () => {
      mockCache.getSession.mockResolvedValueOnce(null)
      mockPrisma.gameSession.findUnique.mockResolvedValueOnce({
        id: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: [],
      })
      const result = await getSessionByPin('482971')
      expect(result).not.toBeNull()
      expect(mockPrisma.gameSession.findUnique).toHaveBeenCalledOnce()
    })

    it('should return null when session does not exist', async () => {
      mockCache.getSession.mockResolvedValueOnce(null)
      mockPrisma.gameSession.findUnique.mockResolvedValueOnce(null)
      const result = await getSessionByPin('000000')
      expect(result).toBeNull()
    })
  })

  describe('finalizeSession', () => {
    it('should persist GameAnswers, update scores in DB and clean Redis', async () => {
      const session: GameSessionState = {
        sessionId: 'session-abc',
        pin: '482971',
        quizId: 'quiz-abc',
        hostSocketId: 'socket-host-1',
        status: 'QUESTION',
        currentQuestionIndex: 0,
        questionStartedAt: null,
        hostDisconnectedAt: null,
        participants: {
          'p-1': { id: 'p-1', nickname: 'Ana', avatarId: '1', score: 750, socketId: 's1', isConnected: true },
        },
      }

      mockPrisma.gameSession.update.mockResolvedValueOnce({ id: 'session-abc' })
      mockPrisma.gameAnswer.createMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p-1', score: 750 })

      await finalizeSession(session)

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-abc' } }),
      )
      expect(mockCache.deleteSession).toHaveBeenCalledWith('482971')
    })
  })
})
