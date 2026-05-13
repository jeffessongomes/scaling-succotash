import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SocketEventHandler = (...args: unknown[]) => void

const socketHandlers: Record<string, SocketEventHandler> = {}

const {
  mockGameSocketEmit,
  mockGameSocketOn,
  mockGameSocketOff,
  mockGameSocketConnect,
  mockGameSocketDisconnect,
} = vi.hoisted(() => ({
  mockGameSocketEmit: vi.fn(),
  mockGameSocketOn: vi.fn(),
  mockGameSocketOff: vi.fn(),
  mockGameSocketConnect: vi.fn(),
  mockGameSocketDisconnect: vi.fn(),
}))

vi.mock('@/lib/socket', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
  gameSocket: {
    emit: mockGameSocketEmit,
    on: (event: string, handler: SocketEventHandler) => {
      socketHandlers[event] = handler
      mockGameSocketOn(event, handler)
    },
    off: mockGameSocketOff,
    connect: mockGameSocketConnect,
    disconnect: mockGameSocketDisconnect,
    connected: false,
  },
}))

const { mockCreateGameSession } = vi.hoisted(() => ({
  mockCreateGameSession: vi.fn(),
}))

vi.mock('@/features/game/api/game.api', () => ({
  createGameSession: mockCreateGameSession,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { accessToken: 'test-token-abc' },
    status: 'authenticated',
  }),
}))

import { useHostGame } from '../useHostGame'

const defaultSession = {
  sessionId: 'session-123',
  pin: '482915',
  status: 'LOBBY',
  quizTitle: 'Capitais do Mundo',
  totalQuestions: 7,
}

function simulateEvent(event: string, payload: unknown) {
  const handler = socketHandlers[event]
  if (handler) act(() => handler(payload))
}

describe('useHostGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k])
    mockCreateGameSession.mockResolvedValue(defaultSession)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should call createGameSession with quizId and token on mount', async () => {
    renderHook(() => useHostGame('quiz-abc-123'))
    await waitFor(() => expect(mockCreateGameSession).toHaveBeenCalledWith(
      { quizId: 'quiz-abc-123' },
      'test-token-abc',
    ))
  })

  it('should connect gameSocket and emit host:join after session is created', async () => {
    renderHook(() => useHostGame('quiz-abc-123'))
    await waitFor(() => expect(mockGameSocketConnect).toHaveBeenCalledOnce())
    expect(mockGameSocketEmit).toHaveBeenCalledWith('host:join', { pin: '482915' })
  })

  it('should disconnect gameSocket on unmount', async () => {
    const { unmount } = renderHook(() => useHostGame('quiz-abc-123'))
    await waitFor(() => expect(mockCreateGameSession).toHaveBeenCalled())
    unmount()
    expect(mockGameSocketDisconnect).toHaveBeenCalledOnce()
  })

  describe('when session is created successfully', () => {
    it('should populate session, set phase to lobby and isConnecting false', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))
      expect(result.current.session?.pin).toBe('482915')
      expect(result.current.session?.quizTitle).toBe('Capitais do Mundo')
      expect(result.current.phase).toBe('lobby')
    })
  })

  describe('when createGameSession fails', () => {
    it('should set connectionError', async () => {
      mockCreateGameSession.mockRejectedValue(new Error('Quiz não está publicado'))
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.connectionError).toBe('Quiz não está publicado'))
      expect(result.current.isConnecting).toBe(false)
    })
  })

  describe('when socket emits session:player-joined', () => {
    it('should add player to list', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:player-joined', {
        participant: { id: 'p-1', nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 0 },
        totalPlayers: 1,
      })

      expect(result.current.players).toHaveLength(1)
      expect(result.current.players[0]).toEqual({ nickname: 'Ana Silva', avatarId: 'avatar-cat' })
    })

    it('should accumulate multiple players', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:player-joined', {
        participant: { id: 'p-1', nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 0 },
        totalPlayers: 1,
      })
      simulateEvent('session:player-joined', {
        participant: { id: 'p-2', nickname: 'João Costa', avatarId: 'avatar-dog', score: 0 },
        totalPlayers: 2,
      })

      expect(result.current.players).toHaveLength(2)
    })
  })

  describe('when socket emits session:question-start', () => {
    it('should set phase to question and populate currentQuestion', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:question-start', {
        question: { id: 'q-1', text: 'Qual é a capital do Brasil?' },
        questionIndex: 0,
        totalQuestions: 7,
        timeLimitSecs: 30,
        questionStartedAt: Date.now(),
      })

      expect(result.current.phase).toBe('question')
      expect(result.current.currentQuestion).toEqual({
        index: 0,
        total: 7,
        text: 'Qual é a capital do Brasil?',
        timeLimitSecs: 30,
      })
      expect(result.current.answeredCount).toBe(0)
    })
  })

  describe('when socket emits session:answer-received', () => {
    it('should update answeredCount', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:question-start', {
        question: { id: 'q-1', text: 'Pergunta?' },
        questionIndex: 0,
        totalQuestions: 7,
        timeLimitSecs: 30,
        questionStartedAt: Date.now(),
      })
      simulateEvent('session:answer-received', { answeredCount: 12, totalPlayers: 25 })

      expect(result.current.answeredCount).toBe(12)
    })
  })

  describe('when socket emits session:answers-revealed', () => {
    it('should set phase to results and map distribution to answerStats.stats', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:answers-revealed', {
        correctOptionId: 'opt-brasilia',
        distribution: { 'opt-brasilia': 20, 'opt-sp': 3 },
        participants: [],
      })

      expect(result.current.phase).toBe('results')
      expect(result.current.answerStats).toEqual({
        correctOptionId: 'opt-brasilia',
        stats: { 'opt-brasilia': 20, 'opt-sp': 3 },
      })
    })
  })

  describe('when socket emits session:leaderboard', () => {
    it('should set phase to leaderboard and populate leaderboard from ranking', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:leaderboard', {
        ranking: [
          { nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 5200, rank: 1 },
          { nickname: 'João Costa', avatarId: 'avatar-dog', score: 4800, rank: 2 },
        ],
        currentQuestionIndex: 0,
        totalQuestions: 7,
      })

      expect(result.current.phase).toBe('leaderboard')
      expect(result.current.leaderboard).toHaveLength(2)
      expect(result.current.leaderboard[0]?.nickname).toBe('Ana Silva')
    })
  })

  describe('when socket emits session:ended', () => {
    it('should set phase to finished and populate leaderboard from ranking', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:ended', {
        ranking: [{ nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 12300, rank: 1 }],
      })

      expect(result.current.phase).toBe('finished')
      expect(result.current.leaderboard[0]?.score).toBe(12300)
    })
  })

  describe('when socket emits session:error', () => {
    it('should populate connectionError', async () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(result.current.isConnecting).toBe(false))

      simulateEvent('session:error', { message: 'Sessão já existe para este quiz' })

      expect(result.current.connectionError).toBe('Sessão já existe para este quiz')
    })
  })

  describe('host actions', () => {
    async function setupWithSession() {
      const hook = renderHook(() => useHostGame('quiz-abc-123'))
      await waitFor(() => expect(hook.result.current.isConnecting).toBe(false))
      return hook
    }

    it('should emit game:start with pin', async () => {
      const { result } = await setupWithSession()
      act(() => result.current.startGame())
      expect(mockGameSocketEmit).toHaveBeenCalledWith('game:start', { pin: '482915' })
    })

    it('should emit game:reveal-answers with pin', async () => {
      const { result } = await setupWithSession()
      act(() => result.current.revealAnswers())
      expect(mockGameSocketEmit).toHaveBeenCalledWith('game:reveal-answers', { pin: '482915' })
    })

    it('should emit game:show-leaderboard with pin', async () => {
      const { result } = await setupWithSession()
      act(() => result.current.showLeaderboard())
      expect(mockGameSocketEmit).toHaveBeenCalledWith('game:show-leaderboard', { pin: '482915' })
    })

    it('should emit game:next-question with pin', async () => {
      const { result } = await setupWithSession()
      act(() => result.current.nextQuestion())
      expect(mockGameSocketEmit).toHaveBeenCalledWith('game:next-question', { pin: '482915' })
    })

    it('should emit game:end with pin', async () => {
      const { result } = await setupWithSession()
      act(() => result.current.endGame())
      expect(mockGameSocketEmit).toHaveBeenCalledWith('game:end', { pin: '482915' })
    })
  })
})
