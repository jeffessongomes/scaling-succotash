import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense } from 'react'
import { render, screen, act } from '@/test/test-utils'
import type { UseHostGameReturn } from '@/features/game/hooks/useHostGame'
import type { GamePhase } from '@/types'
import type { GameSession, QuestionState, AnswerStats, LeaderboardEntry } from '@/features/game/types'

const createGameSession = (overrides?: Partial<GameSession>): GameSession => ({
  pin: '482915',
  quizId: 'quiz-abc-123',
  quizTitle: 'Capitais do Mundo',
  totalQuestions: 7,
  status: 'lobby' as GamePhase,
  ...overrides,
})

const createQuestion = (overrides?: Partial<QuestionState>): QuestionState => ({
  index: 0,
  total: 7,
  text: 'Qual é a capital do Brasil?',
  timeLimitSecs: 30,
  points: 1000,
  ...overrides,
})

const createAnswerStats = (): AnswerStats => ({
  correctOptionId: 'opt-brasilia',
  stats: { 'opt-brasilia': 20, 'opt-sp': 3 },
})

const createLeaderboardEntry = (overrides?: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  nickname: 'Ana Silva',
  avatarId: 'avatar-cat',
  score: 5200,
  rank: 1,
  ...overrides,
})

function makeDefaultHookReturn(overrides?: Partial<UseHostGameReturn>): UseHostGameReturn {
  return {
    session: createGameSession(),
    phase: 'lobby' as GamePhase,
    isConnecting: false,
    connectionError: null,
    players: [],
    currentQuestion: null,
    answeredCount: 0,
    answerStats: null,
    leaderboard: [],
    startGame: vi.fn(),
    nextQuestion: vi.fn(),
    revealAnswers: vi.fn(),
    showLeaderboard: vi.fn(),
    endGame: vi.fn(),
    ...overrides,
  }
}

const { mockUseHostGame } = vi.hoisted(() => ({
  mockUseHostGame: vi.fn<() => UseHostGameReturn>(),
}))

vi.mock('@/features/game/hooks/useHostGame', () => ({
  useHostGame: mockUseHostGame,
}))

vi.mock('@/components/game/WaitingLobby', () => ({
  WaitingLobby: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="view-waiting-lobby">
      <button data-testid="btn-start-game-mock" onClick={onStart}>Iniciar</button>
    </div>
  ),
}))

vi.mock('@/components/game/QuestionControl', () => ({
  QuestionControl: ({ onReveal, onEnd }: { onReveal: () => void; onEnd: () => void }) => (
    <div data-testid="view-question-control">
      <button data-testid="btn-reveal-mock" onClick={onReveal}>Revelar</button>
      <button data-testid="btn-end-mock" onClick={onEnd}>Encerrar</button>
    </div>
  ),
}))

vi.mock('@/components/game/AnswerReveal', () => ({
  AnswerReveal: ({
    onShowLeaderboard,
    onNextQuestion,
    onEnd,
  }: {
    onShowLeaderboard: () => void
    onNextQuestion: () => void
    onEnd: () => void
  }) => (
    <div data-testid="view-answer-reveal">
      <button data-testid="btn-show-leaderboard-mock" onClick={onShowLeaderboard}>Ver Placar</button>
      <button data-testid="btn-next-question-mock" onClick={onNextQuestion}>Próxima</button>
      <button data-testid="btn-end-reveal-mock" onClick={onEnd}>Encerrar</button>
    </div>
  ),
}))

vi.mock('@/components/game/LeaderboardView', () => ({
  LeaderboardView: ({
    onNextQuestion,
    onEnd,
  }: {
    onNextQuestion: () => void
    onEnd: () => void
  }) => (
    <div data-testid="view-leaderboard">
      <button data-testid="btn-next-from-leaderboard-mock" onClick={onNextQuestion}>Próxima</button>
      <button data-testid="btn-end-leaderboard-mock" onClick={onEnd}>Encerrar</button>
    </div>
  ),
}))

vi.mock('@/components/game/FinishedView', () => ({
  FinishedView: () => <div data-testid="view-finished" />,
}))

import HostPage from './page'

async function renderPage(hookReturn: UseHostGameReturn) {
  mockUseHostGame.mockReturnValue(hookReturn)
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <HostPage params={Promise.resolve({ id: 'quiz-abc-123' })} />
      </Suspense>,
    )
  })
}

describe('HostPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when phase is lobby', () => {
    it('should render WaitingLobby', async () => {
      await renderPage(makeDefaultHookReturn({ phase: 'lobby' }))
      expect(screen.getByTestId('view-waiting-lobby')).toBeInTheDocument()
    })

    it('should call startGame when Iniciar is clicked', async () => {
      const startGame = vi.fn()
      await renderPage(makeDefaultHookReturn({ phase: 'lobby', startGame }))
      await act(async () => { screen.getByTestId('btn-start-game-mock').click() })
      expect(startGame).toHaveBeenCalledOnce()
    })
  })

  describe('when phase is question', () => {
    it('should render QuestionControl', async () => {
      await renderPage(makeDefaultHookReturn({ phase: 'question', currentQuestion: createQuestion() }))
      expect(screen.getByTestId('view-question-control')).toBeInTheDocument()
    })

    it('should call revealAnswers when Revelar is clicked', async () => {
      const revealAnswers = vi.fn()
      await renderPage(makeDefaultHookReturn({ phase: 'question', currentQuestion: createQuestion(), revealAnswers }))
      await act(async () => { screen.getByTestId('btn-reveal-mock').click() })
      expect(revealAnswers).toHaveBeenCalledOnce()
    })
  })

  describe('when phase is results', () => {
    it('should render AnswerReveal', async () => {
      await renderPage(
        makeDefaultHookReturn({
          phase: 'results',
          currentQuestion: createQuestion(),
          answerStats: createAnswerStats(),
        }),
      )
      expect(screen.getByTestId('view-answer-reveal')).toBeInTheDocument()
    })

    it('should call showLeaderboard when Ver Placar is clicked', async () => {
      const showLeaderboard = vi.fn()
      await renderPage(
        makeDefaultHookReturn({
          phase: 'results',
          currentQuestion: createQuestion(),
          answerStats: createAnswerStats(),
          showLeaderboard,
        }),
      )
      await act(async () => { screen.getByTestId('btn-show-leaderboard-mock').click() })
      expect(showLeaderboard).toHaveBeenCalledOnce()
    })
  })

  describe('when phase is leaderboard', () => {
    it('should render LeaderboardView', async () => {
      await renderPage(
        makeDefaultHookReturn({ phase: 'leaderboard', leaderboard: [createLeaderboardEntry()] }),
      )
      expect(screen.getByTestId('view-leaderboard')).toBeInTheDocument()
    })

    it('should call nextQuestion when Próxima is clicked from leaderboard', async () => {
      const nextQuestion = vi.fn()
      await renderPage(
        makeDefaultHookReturn({
          phase: 'leaderboard',
          leaderboard: [createLeaderboardEntry()],
          nextQuestion,
        }),
      )
      await act(async () => { screen.getByTestId('btn-next-from-leaderboard-mock').click() })
      expect(nextQuestion).toHaveBeenCalledOnce()
    })
  })

  describe('when phase is finished', () => {
    it('should render FinishedView', async () => {
      await renderPage(
        makeDefaultHookReturn({ phase: 'finished', leaderboard: [createLeaderboardEntry()] }),
      )
      expect(screen.getByTestId('view-finished')).toBeInTheDocument()
    })
  })

  describe('when endGame is triggered', () => {
    it('should open confirm dialog and call endGame on confirm', async () => {
      const endGame = vi.fn()
      await renderPage(
        makeDefaultHookReturn({ phase: 'question', currentQuestion: createQuestion(), endGame }),
      )

      await act(async () => { screen.getByTestId('btn-end-mock').click() })
      expect(screen.getByTestId('modal-confirm-delete')).toBeInTheDocument()

      await act(async () => { screen.getByTestId('btn-confirm-delete').click() })
      expect(endGame).toHaveBeenCalledOnce()
    })
  })

  describe('when isConnecting is true', () => {
    it('should show reconnecting banner', async () => {
      await renderPage(makeDefaultHookReturn({ isConnecting: true, session: null }))
      expect(screen.getByTestId('banner-connecting')).toBeInTheDocument()
    })
  })

  describe('when connectionError is set', () => {
    it('should show error message', async () => {
      await renderPage(
        makeDefaultHookReturn({ connectionError: 'Sessão já existe para este quiz', session: null }),
      )
      expect(screen.getByTestId('banner-connection-error')).toBeInTheDocument()
    })
  })
})
