import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'http'
import { Server } from 'socket.io'
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client'
import jwt from 'jsonwebtoken'
import type { AnswerRecord } from '../game.types.js'

const { mockCache } = vi.hoisted(() => ({
  mockCache: {
    getSession: vi.fn(),
    saveSession: vi.fn().mockResolvedValue(undefined),
    updateScore: vi.fn().mockResolvedValue(undefined),
    saveAnswer: vi.fn().mockResolvedValue(true),
    getAnswers: vi.fn().mockResolvedValue({} as Record<string, AnswerRecord>),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    deleteAnswers: vi.fn().mockResolvedValue(undefined),
  },
}))

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    quiz: { findUnique: vi.fn() },
    gameSession: { update: vi.fn() },
    gameAnswer: { createMany: vi.fn() },
    gameParticipant: { upsert: vi.fn(), findMany: vi.fn() },
  },
}))

vi.mock('../../../infrastructure/cache/game-state.cache.js', () => mockCache)
vi.mock('../../../config/database.js', () => ({ prisma: mockPrisma }))
vi.mock('../game.service.js', () => ({
  finalizeSession: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn(),
  getSessionByPin: vi.fn(),
}))

const { setupGameSocket } = await import('../game.socket.js')

const JWT_SECRET = 'test-secret-minimum-32-characters-long!!!'

function createHostToken(userId = 'user-teacher-001'): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' })
}

function createLobbySession(pin = '482971') {
  return {
    sessionId: 'session-abc',
    pin,
    quizId: 'quiz-xyz',
    hostSocketId: '',
    status: 'LOBBY' as const,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    hostDisconnectedAt: null,
    participants: {} as Record<string, {
      id: string; nickname: string; avatarId: string;
      score: number; socketId: string; isConnected: boolean;
    }>,
  }
}

function createQuizWithQuestions() {
  return {
    questions: [
      {
        id: 'q-1',
        text: 'Capital do Brasil?',
        timeLimitSecs: 30,
        points: 1000,
        mediaType: null,
        mediaUrl: null,
        order: 1,
        options: [
          { id: 'opt-correct', text: 'Brasília', isCorrect: true, color: 'GREEN', order: 1 },
          { id: 'opt-wrong', text: 'São Paulo', isCorrect: false, color: 'RED', order: 2 },
        ],
      },
    ],
  }
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeout = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeout)
    socket.once(event, (data: T) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}

function connectAndWait(socket: ClientSocket): Promise<void> {
  return new Promise((resolve) => socket.on('connect', resolve))
}

async function joinRoom(socket: ClientSocket, pin: string, sessionState: ReturnType<typeof createLobbySession>): Promise<void> {
  mockCache.getSession.mockResolvedValueOnce({ ...sessionState, hostSocketId: '' })
  socket.emit('host:join', { pin })
  await new Promise((r) => setTimeout(r, 80))
}

describe('game.socket', () => {
  let server: http.Server
  let io: Server
  let port: number
  let openSockets: ClientSocket[]

  beforeEach(async () => {
    vi.clearAllMocks()
    openSockets = []

    server = http.createServer()
    io = new Server(server, { cors: { origin: '*' } })
    setupGameSocket(io)

    await new Promise<void>((resolve) => server.listen(0, resolve))
    const address = server.address()
    port = typeof address === 'object' && address ? address.port : 0
  })

  afterEach(async () => {
    for (const s of openSockets) s.disconnect()
    await new Promise<void>((resolve) => {
      io.close(() => server.close(() => resolve()))
    })
  })

  function connectHost(): ClientSocket {
    const s = ioc(`http://localhost:${port}/game`, {
      auth: { token: createHostToken() },
      reconnection: false,
    })
    openSockets.push(s)
    return s
  }

  function connectPlayer(): ClientSocket {
    const s = ioc(`http://localhost:${port}/game`, { reconnection: false })
    openSockets.push(s)
    return s
  }

  describe('player:join', () => {
    it('should emit session:player-joined to the room when a player joins a LOBBY', async () => {
      const session = createLobbySession()
      mockCache.getSession.mockResolvedValue(session)

      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const joinedPromise = waitForEvent<{ participant: unknown; totalPlayers: number }>(
        playerSocket,
        'session:player-joined',
      )

      playerSocket.emit('player:join', { pin: '482971', nickname: 'Ana', avatarId: '1' })

      const result = await joinedPromise
      expect(result.totalPlayers).toBe(1)
    })

    it('should emit session:error NICKNAME_TAKEN when nickname is already connected', async () => {
      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 0, socketId: 'existing-socket', isConnected: true,
      }
      mockCache.getSession.mockResolvedValue(session)

      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const errorPromise = waitForEvent<{ code: string }>(playerSocket, 'session:error')
      playerSocket.emit('player:join', { pin: '482971', nickname: 'Ana', avatarId: '2' })

      const error = await errorPromise
      expect(error.code).toBe('NICKNAME_TAKEN')
    })

    it('should emit session:error SESSION_NOT_ACCEPTING when session is in QUESTION', async () => {
      const session = { ...createLobbySession(), status: 'QUESTION' as const }
      mockCache.getSession.mockResolvedValue(session)

      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const errorPromise = waitForEvent<{ code: string }>(playerSocket, 'session:error')
      playerSocket.emit('player:join', { pin: '482971', nickname: 'Carlos', avatarId: '3' })

      const error = await errorPromise
      expect(error.code).toBe('SESSION_NOT_ACCEPTING')
    })
  })

  describe('game:start', () => {
    it('should emit session:question-start when host starts with valid session and players', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 0, socketId: 'player-sock', isConnected: true,
      }

      // Join room first (host:join puts host into game:{pin} room)
      await joinRoom(hostSocket, '482971', session)

      // After joining, mock returns session with correct hostSocketId
      mockCache.getSession.mockResolvedValue({ ...session, hostSocketId: hostSocket.id ?? '' })
      mockPrisma.quiz.findUnique.mockResolvedValue(createQuizWithQuestions())

      const questionStartPromise = waitForEvent<unknown>(hostSocket, 'session:question-start')

      hostSocket.emit('game:start', { pin: '482971' })

      const result = await questionStartPromise
      expect(result).toBeDefined()
    }, 10_000)

    it('should emit session:error QUIZ_EMPTY when quiz has no questions', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 0, socketId: 'player-sock', isConnected: true,
      }

      mockCache.getSession.mockResolvedValue({ ...session, hostSocketId: hostSocket.id ?? '' })
      mockPrisma.quiz.findUnique.mockResolvedValue({ questions: [] })

      const errorPromise = waitForEvent<{ code: string }>(hostSocket, 'session:error')
      hostSocket.emit('game:start', { pin: '482971' })

      const error = await errorPromise
      expect(error.code).toBe('QUIZ_EMPTY')
    })

    it('should emit session:error NOT_HOST when a player tries to start', async () => {
      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 0, socketId: playerSocket.id ?? '', isConnected: true,
      }
      mockCache.getSession.mockResolvedValue({ ...session, hostSocketId: 'different-host-id' })

      const errorPromise = waitForEvent<{ code: string }>(playerSocket, 'session:error')
      playerSocket.emit('game:start', { pin: '482971' })

      const error = await errorPromise
      expect(error.code).toBe('NOT_HOST')
    })
  })

  describe('player:answer', () => {
    it('should emit session:answer-received to host when player answers in QUESTION phase', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const session = createLobbySession()
      const participantId = 'p-1'
      session.participants[participantId] = {
        id: participantId, nickname: 'Ana', avatarId: '1',
        score: 0, socketId: playerSocket.id ?? '', isConnected: true,
      }

      // Join room so host is reachable
      await joinRoom(hostSocket, '482971', session)

      mockCache.getSession.mockResolvedValue({
        ...session,
        hostSocketId: hostSocket.id ?? '',
        status: 'QUESTION',
      })
      mockCache.getAnswers.mockResolvedValue({
        [participantId]: { optionId: 'opt-correct', answeredInMs: 5000 },
      } satisfies Record<string, AnswerRecord>)
      mockPrisma.quiz.findUnique.mockResolvedValue({
        questions: [{ id: 'q-1', timeLimitSecs: 30 }],
      })

      const answerReceivedPromise = waitForEvent<{ answeredCount: number; totalPlayers: number }>(
        hostSocket,
        'session:answer-received',
        8000,
      )

      playerSocket.emit('player:answer', {
        pin: '482971', questionId: 'q-1',
        optionId: 'opt-correct', answeredInMs: 5000,
      })

      const result = await answerReceivedPromise
      expect(result.answeredCount).toBe(1)
    }, 10_000)

    it('should pass optionId to saveAnswer', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      const playerSocket = connectPlayer()
      await connectAndWait(playerSocket)

      const session = createLobbySession()
      const participantId = 'p-1'
      session.participants[participantId] = {
        id: participantId, nickname: 'Ana', avatarId: '1',
        score: 0, socketId: playerSocket.id ?? '', isConnected: true,
      }

      await joinRoom(hostSocket, '482971', session)

      mockCache.getSession.mockResolvedValue({
        ...session,
        hostSocketId: hostSocket.id ?? '',
        status: 'QUESTION',
      })
      mockCache.getAnswers.mockResolvedValue({})
      mockPrisma.quiz.findUnique.mockResolvedValue({
        questions: [{ id: 'q-1', timeLimitSecs: 30 }],
      })

      playerSocket.emit('player:answer', {
        pin: '482971', questionId: 'q-1',
        optionId: 'opt-correct', answeredInMs: 5000,
      })

      await new Promise((r) => setTimeout(r, 500))

      expect(mockCache.saveAnswer).toHaveBeenCalledWith(
        '482971', 'q-1', participantId, 'opt-correct', 5000,
      )
    }, 8000)
  })

  describe('game:reveal-answers', () => {
    async function setupRevealScenario(hostSocket: ClientSocket, answers: Record<string, AnswerRecord>) {
      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 0, socketId: 'player-sock', isConnected: true,
      }

      await joinRoom(hostSocket, '482971', session)

      mockCache.getSession.mockResolvedValue({
        ...session,
        hostSocketId: hostSocket.id ?? '',
        status: 'QUESTION',
      })
      mockCache.getAnswers.mockResolvedValue(answers)
      mockPrisma.quiz.findUnique.mockResolvedValue(createQuizWithQuestions())
    }

    it('should set distribution[correctOptionId] = 1 and score > 0 when player answers correctly', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      await setupRevealScenario(hostSocket, {
        'p-1': { optionId: 'opt-correct', answeredInMs: 5000 },
      })

      const revealedPromise = waitForEvent<{
        correctOptionId: string
        distribution: Record<string, number>
        participants: Array<{ id: string; score: number }>
      }>(hostSocket, 'session:answers-revealed')

      hostSocket.emit('game:reveal-answers', { pin: '482971' })

      const result = await revealedPromise
      expect(result.correctOptionId).toBe('opt-correct')
      expect(result.distribution['opt-correct']).toBe(1)
      expect(result.distribution['opt-wrong']).toBe(0)
      const p1 = result.participants.find((p) => p.id === 'p-1')
      expect(p1?.score).toBeGreaterThan(0)
    }, 8000)

    it('should set distribution[wrongOptionId] = 1 and score = 0 when player answers incorrectly', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      await setupRevealScenario(hostSocket, {
        'p-1': { optionId: 'opt-wrong', answeredInMs: 5000 },
      })

      const revealedPromise = waitForEvent<{
        correctOptionId: string
        distribution: Record<string, number>
        participants: Array<{ id: string; score: number }>
      }>(hostSocket, 'session:answers-revealed')

      hostSocket.emit('game:reveal-answers', { pin: '482971' })

      const result = await revealedPromise
      expect(result.distribution['opt-wrong']).toBe(1)
      expect(result.distribution['opt-correct']).toBe(0)
      const p1 = result.participants.find((p) => p.id === 'p-1')
      expect(p1?.score).toBe(0)
    }, 8000)

    it('should produce zeroed distribution when no players answered', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      await setupRevealScenario(hostSocket, {})

      const revealedPromise = waitForEvent<{
        distribution: Record<string, number>
      }>(hostSocket, 'session:answers-revealed')

      hostSocket.emit('game:reveal-answers', { pin: '482971' })

      const result = await revealedPromise
      expect(result.distribution['opt-correct']).toBe(0)
      expect(result.distribution['opt-wrong']).toBe(0)
    }, 8000)
  })

  describe('game:end', () => {
    it('should emit session:ended with ranking when host ends the game', async () => {
      const hostSocket = connectHost()
      await connectAndWait(hostSocket)

      const session = createLobbySession()
      session.participants['p-1'] = {
        id: 'p-1', nickname: 'Ana', avatarId: '1',
        score: 750, socketId: 'player-sock', isConnected: true,
      }

      // Join room first
      await joinRoom(hostSocket, '482971', session)

      mockCache.getSession.mockResolvedValue({
        ...session,
        hostSocketId: hostSocket.id ?? '',
        status: 'LEADERBOARD',
      })

      const endedPromise = waitForEvent<{ ranking: unknown[] }>(hostSocket, 'session:ended')
      hostSocket.emit('game:end', { pin: '482971' })

      const result = await endedPromise
      expect(result.ranking).toHaveLength(1)
      expect(result.ranking[0]).toMatchObject({ nickname: 'Ana', score: 750 })
    })
  })
})
