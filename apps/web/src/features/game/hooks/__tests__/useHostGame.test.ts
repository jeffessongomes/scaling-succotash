import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SocketEventHandler = (...args: unknown[]) => void

const socketHandlers: Record<string, SocketEventHandler> = {}

const {
  mockSocketEmit,
  mockSocketOn,
  mockSocketOff,
  mockSocketConnect,
  mockSocketDisconnect,
} = vi.hoisted(() => ({
  mockSocketEmit: vi.fn(),
  mockSocketOn: vi.fn(),
  mockSocketOff: vi.fn(),
  mockSocketConnect: vi.fn(),
  mockSocketDisconnect: vi.fn(),
}))

vi.mock('@/lib/socket', () => ({
  socket: {
    emit: mockSocketEmit,
    on: (event: string, handler: SocketEventHandler) => {
      socketHandlers[event] = handler
      mockSocketOn(event, handler)
    },
    off: mockSocketOff,
    connect: mockSocketConnect,
    disconnect: mockSocketDisconnect,
    connected: false,
  },
}))

import { useHostGame } from '../useHostGame'

function simulateEvent(event: string, payload: unknown) {
  const handler = socketHandlers[event]
  if (handler) act(() => handler(payload))
}

describe('useHostGame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should connect socket and emit host:create-session on mount', () => {
    renderHook(() => useHostGame('quiz-abc-123'))
    expect(mockSocketConnect).toHaveBeenCalledOnce()
    expect(mockSocketEmit).toHaveBeenCalledWith('host:create-session', { quizId: 'quiz-abc-123' })
  })

  it('should disconnect socket on unmount', () => {
    const { unmount } = renderHook(() => useHostGame('quiz-abc-123'))
    unmount()
    expect(mockSocketDisconnect).toHaveBeenCalledOnce()
  })

  describe('when socket emits session:created', () => {
    it('should populate session and set phase to lobby', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', {
        pin: '482915',
        quizTitle: 'Capitais do Mundo',
        totalQuestions: 7,
      })

      expect(result.current.session).toEqual({
        pin: '482915',
        quizId: 'quiz-abc-123',
        quizTitle: 'Capitais do Mundo',
        totalQuestions: 7,
        status: 'lobby',
      })
      expect(result.current.phase).toBe('lobby')
      expect(result.current.isConnecting).toBe(false)
    })
  })

  describe('when socket emits session:player-joined', () => {
    it('should add player to list', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:player-joined', { nickname: 'Ana Silva', avatarId: 'avatar-cat', totalPlayers: 1 })

      expect(result.current.players).toHaveLength(1)
      expect(result.current.players[0]).toEqual({ nickname: 'Ana Silva', avatarId: 'avatar-cat' })
    })

    it('should accumulate multiple players', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:player-joined', { nickname: 'Ana Silva', avatarId: 'avatar-cat', totalPlayers: 1 })
      simulateEvent('session:player-joined', { nickname: 'João Costa', avatarId: 'avatar-dog', totalPlayers: 2 })

      expect(result.current.players).toHaveLength(2)
    })
  })

  describe('when socket emits session:question-start', () => {
    it('should set phase to question and populate currentQuestion', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:question-start', {
        question: { text: 'Qual é a capital do Brasil?', timeLimitSecs: 30, points: 1000 },
        questionIndex: 0,
        totalQuestions: 7,
      })

      expect(result.current.phase).toBe('question')
      expect(result.current.currentQuestion).toEqual({
        index: 0,
        total: 7,
        text: 'Qual é a capital do Brasil?',
        timeLimitSecs: 30,
        points: 1000,
      })
      expect(result.current.answeredCount).toBe(0)
    })
  })

  describe('when socket emits session:answer-received', () => {
    it('should update answeredCount', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:question-start', {
        question: { text: 'Pergunta?', timeLimitSecs: 30, points: 1000 },
        questionIndex: 0,
        totalQuestions: 7,
      })
      simulateEvent('session:answer-received', { totalAnswered: 12, totalPlayers: 25 })

      expect(result.current.answeredCount).toBe(12)
    })
  })

  describe('when socket emits session:answers-revealed', () => {
    it('should set phase to results and populate answerStats', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:question-start', {
        question: { text: 'Pergunta?', timeLimitSecs: 30, points: 1000 },
        questionIndex: 0,
        totalQuestions: 7,
      })
      simulateEvent('session:answers-revealed', {
        correctOptionId: 'opt-brasilia',
        stats: { 'opt-brasilia': 20, 'opt-sp': 3 },
      })

      expect(result.current.phase).toBe('results')
      expect(result.current.answerStats).toEqual({
        correctOptionId: 'opt-brasilia',
        stats: { 'opt-brasilia': 20, 'opt-sp': 3 },
      })
    })
  })

  describe('when socket emits session:leaderboard', () => {
    it('should set phase to leaderboard and populate leaderboard', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:leaderboard', {
        top3: [
          { nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 5200, rank: 1 },
          { nickname: 'João Costa', avatarId: 'avatar-dog', score: 4800, rank: 2 },
        ],
      })

      expect(result.current.phase).toBe('leaderboard')
      expect(result.current.leaderboard).toHaveLength(2)
      expect(result.current.leaderboard[0].nickname).toBe('Ana Silva')
    })
  })

  describe('when socket emits session:ended', () => {
    it('should set phase to finished and populate leaderboard with final data', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })
      simulateEvent('session:ended', {
        finalLeaderboard: [
          { nickname: 'Ana Silva', avatarId: 'avatar-cat', score: 12300, rank: 1 },
        ],
      })

      expect(result.current.phase).toBe('finished')
      expect(result.current.leaderboard[0].score).toBe(12300)
    })
  })

  describe('when socket emits session:error', () => {
    it('should populate connectionError', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))

      simulateEvent('session:error', { message: 'Sessão já existe para este quiz' })

      expect(result.current.connectionError).toBe('Sessão já existe para este quiz')
    })
  })

  describe('host actions', () => {
    it('should emit game:start with pin when startGame is called', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })

      act(() => result.current.startGame())

      expect(mockSocketEmit).toHaveBeenCalledWith('game:start', { pin: '482915' })
    })

    it('should emit game:reveal-answers with pin when revealAnswers is called', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })

      act(() => result.current.revealAnswers())

      expect(mockSocketEmit).toHaveBeenCalledWith('game:reveal-answers', { pin: '482915' })
    })

    it('should emit game:show-leaderboard with pin when showLeaderboard is called', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })

      act(() => result.current.showLeaderboard())

      expect(mockSocketEmit).toHaveBeenCalledWith('game:show-leaderboard', { pin: '482915' })
    })

    it('should emit game:next-question with pin when nextQuestion is called', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })

      act(() => result.current.nextQuestion())

      expect(mockSocketEmit).toHaveBeenCalledWith('game:next-question', { pin: '482915' })
    })

    it('should emit game:end with pin when endGame is called', () => {
      const { result } = renderHook(() => useHostGame('quiz-abc-123'))
      simulateEvent('session:created', { pin: '482915', quizTitle: 'Capitais do Mundo', totalQuestions: 7 })

      act(() => result.current.endGame())

      expect(mockSocketEmit).toHaveBeenCalledWith('game:end', { pin: '482915' })
    })
  })
})
