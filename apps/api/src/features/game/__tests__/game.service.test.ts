import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GameSessionState, AnswerRecord } from '../game.types.js'

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
    deleteAnswers: vi.fn().mockResolvedValue(undefined),
    getAnswers: vi.fn().mockResolvedValue({} as Record<string, AnswerRecord>),
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

const { createSession, getSessionByPin, getSessionById, finalizeSession } = await import('../game.service.js')

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
        authorId: 'user-teacher',
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

  describe('getSessionById', () => {
    it('should return session state when ID exists and session is in Redis', async () => {
      const session: GameSessionState = {
        sessionId: 'session-abc',
        pin: '482971',
        quizId: 'quiz-abc',
        authorId: 'user-teacher',
        hostSocketId: 'socket-host-1',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        questionStartedAt: null,
        hostDisconnectedAt: null,
        participants: {},
      }
      mockPrisma.gameSession.findUnique.mockResolvedValueOnce({ pin: '482971' })
      mockCache.getSession.mockResolvedValueOnce(session)

      const result = await getSessionById('session-abc')

      expect(result).toEqual(session)
      expect(mockPrisma.gameSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-abc' },
        select: { pin: true },
      })
    })

    it('should fallback to PostgreSQL when ID exists but session is not in Redis', async () => {
      mockPrisma.gameSession.findUnique
        .mockResolvedValueOnce({ pin: '482971' })
        .mockResolvedValueOnce({
          id: 'session-abc',
          pin: '482971',
          status: 'LOBBY',
          currentQuestionIndex: 0,
          quizId: 'quiz-abc',
          participants: [],
        })
      mockCache.getSession.mockResolvedValueOnce(null)

      const result = await getSessionById('session-abc')

      expect(result).not.toBeNull()
      expect(result?.pin).toBe('482971')
    })

    it('should return null when session ID does not exist', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValueOnce(null)

      const result = await getSessionById('nonexistent-id')

      expect(result).toBeNull()
      expect(mockCache.getSession).not.toHaveBeenCalled()
    })
  })

  describe('finalizeSession', () => {
    function createSessionWithParticipant(): GameSessionState {
      return {
        sessionId: 'session-abc',
        pin: '482971',
        quizId: 'quiz-abc',
        authorId: 'user-teacher',
        hostSocketId: 'socket-host-1',
        status: 'QUESTION',
        currentQuestionIndex: 0,
        questionStartedAt: null,
        hostDisconnectedAt: null,
        participants: {
          'p-1': { id: 'p-1', nickname: 'Ana', avatarId: '1', score: 750, socketId: 's1', isConnected: true },
        },
      }
    }

    it('should persist GameAnswers, update scores in DB and clean Redis', async () => {
      const session = createSessionWithParticipant()

      mockPrisma.gameSession.update.mockResolvedValueOnce({ id: 'session-abc' })
      mockPrisma.gameAnswer.createMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p-1', score: 750 })

      await finalizeSession(session)

      expect(mockPrisma.gameSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'session-abc' } }),
      )
      expect(mockCache.deleteSession).toHaveBeenCalledWith('482971')
    })

    it('should persist the player optionId (not answeredInMs as string) in GameAnswer', async () => {
      const session = createSessionWithParticipant()

      mockCache.getAnswers.mockResolvedValueOnce({
        'p-1': { optionId: 'opt-1', answeredInMs: 8000 },
      } satisfies Record<string, AnswerRecord>)
      mockPrisma.quiz.findUnique.mockResolvedValueOnce({
        questions: [createQuiz().questions[0]],
      })
      mockPrisma.gameSession.update.mockResolvedValueOnce({ id: 'session-abc' })
      mockPrisma.gameAnswer.createMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p-1', score: 750 })

      await finalizeSession(session)

      const createManyCall = mockPrisma.gameAnswer.createMany.mock.calls[0] as [{ data: Array<{ optionId: string; isCorrect: boolean; answeredInMs: number }> }]
      const record = createManyCall[0].data[0]
      expect(record.optionId).toBe('opt-1')
      expect(record.answeredInMs).toBe(8000)
    })

    it('should set isCorrect = false when player chose the wrong option', async () => {
      const session = createSessionWithParticipant()

      mockCache.getAnswers.mockResolvedValueOnce({
        'p-1': { optionId: 'opt-2', answeredInMs: 5000 },
      } satisfies Record<string, AnswerRecord>)
      mockPrisma.quiz.findUnique.mockResolvedValueOnce({
        questions: [createQuiz().questions[0]],
      })
      mockPrisma.gameSession.update.mockResolvedValueOnce({ id: 'session-abc' })
      mockPrisma.gameAnswer.createMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p-1', score: 750 })

      await finalizeSession(session)

      const createManyCall = mockPrisma.gameAnswer.createMany.mock.calls[0] as [{ data: Array<{ isCorrect: boolean }> }]
      expect(createManyCall[0].data[0].isCorrect).toBe(false)
    })

    it('should set isCorrect = true when player chose the correct option', async () => {
      const session = createSessionWithParticipant()

      mockCache.getAnswers.mockResolvedValueOnce({
        'p-1': { optionId: 'opt-1', answeredInMs: 5000 },
      } satisfies Record<string, AnswerRecord>)
      mockPrisma.quiz.findUnique.mockResolvedValueOnce({
        questions: [createQuiz().questions[0]],
      })
      mockPrisma.gameSession.update.mockResolvedValueOnce({ id: 'session-abc' })
      mockPrisma.gameAnswer.createMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.gameParticipant.upsert.mockResolvedValue({ id: 'p-1', score: 750 })

      await finalizeSession(session)

      const createManyCall = mockPrisma.gameAnswer.createMany.mock.calls[0] as [{ data: Array<{ isCorrect: boolean }> }]
      expect(createManyCall[0].data[0].isCorrect).toBe(true)
    })
  })
})
