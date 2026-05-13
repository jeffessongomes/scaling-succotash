import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { gameSocket } from '@/lib/socket'
import { createGameSession } from '../api/game.api'
import type { GamePhase } from '@/types'
import type { GameSession, GamePlayer, QuestionState, AnswerStats, LeaderboardEntry } from '../types'

interface PlayerJoinedPayload {
  participant: { id: string; nickname: string; avatarId: string; score: number }
  totalPlayers: number
}

interface QuestionStartPayload {
  question: { id: string; text: string }
  questionIndex: number
  totalQuestions: number
  timeLimitSecs: number
}

interface AnswerReceivedPayload {
  answeredCount: number
  totalPlayers: number
}

interface AnswersRevealedPayload {
  correctOptionId: string
  distribution: Record<string, number>
}

interface LeaderboardPayload {
  ranking: LeaderboardEntry[]
}

interface SessionEndedPayload {
  ranking: LeaderboardEntry[]
}

interface SessionErrorPayload {
  message: string
}

export interface UseHostGameReturn {
  session: GameSession | null
  phase: GamePhase
  isConnecting: boolean
  connectionError: string | null
  players: GamePlayer[]
  currentQuestion: QuestionState | null
  answeredCount: number
  answerStats: AnswerStats | null
  leaderboard: LeaderboardEntry[]
  startGame: () => void
  nextQuestion: () => void
  revealAnswers: () => void
  showLeaderboard: () => void
  endGame: () => void
}

export function useHostGame(quizId: string): UseHostGameReturn {
  const { data: sessionData } = useSession()
  const [session, setSession] = useState<GameSession | null>(null)
  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuestionState | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [answerStats, setAnswerStats] = useState<AnswerStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    const token = (sessionData as { accessToken?: string } | null)?.accessToken
    if (!token || initialized.current) return
    initialized.current = true

    createGameSession({ quizId }, token)
      .then((result) => {
        setSession({
          pin: result.pin,
          quizId,
          quizTitle: result.quizTitle,
          totalQuestions: result.totalQuestions,
          status: 'lobby',
        })
        setPhase('lobby')
        setIsConnecting(false)

        gameSocket.connect()
        gameSocket.emit('host:join', { pin: result.pin })
      })
      .catch((err: Error) => {
        setConnectionError(err.message ?? 'Erro ao criar sessão')
        setIsConnecting(false)
      })

    function onPlayerJoined(payload: PlayerJoinedPayload) {
      setPlayers((prev) => [
        ...prev,
        { nickname: payload.participant.nickname, avatarId: payload.participant.avatarId },
      ])
    }

    function onQuestionStart(payload: QuestionStartPayload) {
      setPhase('question')
      setAnsweredCount(0)
      setAnswerStats(null)
      setCurrentQuestion({
        index: payload.questionIndex,
        total: payload.totalQuestions,
        text: payload.question.text,
        timeLimitSecs: payload.timeLimitSecs,
      })
    }

    function onAnswerReceived(payload: AnswerReceivedPayload) {
      setAnsweredCount(payload.answeredCount)
    }

    function onAnswersRevealed(payload: AnswersRevealedPayload) {
      setPhase('results')
      setAnswerStats({ correctOptionId: payload.correctOptionId, stats: payload.distribution })
    }

    function onLeaderboard(payload: LeaderboardPayload) {
      setPhase('leaderboard')
      setLeaderboard(payload.ranking)
    }

    function onSessionEnded(payload: SessionEndedPayload) {
      setPhase('finished')
      setLeaderboard(payload.ranking)
    }

    function onSessionError(payload: SessionErrorPayload) {
      setConnectionError(payload.message)
    }

    gameSocket.on('session:player-joined', onPlayerJoined)
    gameSocket.on('session:question-start', onQuestionStart)
    gameSocket.on('session:answer-received', onAnswerReceived)
    gameSocket.on('session:answers-revealed', onAnswersRevealed)
    gameSocket.on('session:leaderboard', onLeaderboard)
    gameSocket.on('session:ended', onSessionEnded)
    gameSocket.on('session:error', onSessionError)

    return () => {
      gameSocket.off('session:player-joined', onPlayerJoined)
      gameSocket.off('session:question-start', onQuestionStart)
      gameSocket.off('session:answer-received', onAnswerReceived)
      gameSocket.off('session:answers-revealed', onAnswersRevealed)
      gameSocket.off('session:leaderboard', onLeaderboard)
      gameSocket.off('session:ended', onSessionEnded)
      gameSocket.off('session:error', onSessionError)
      gameSocket.disconnect()
    }
  }, [quizId, sessionData])

  const startGame = useCallback(() => {
    if (session) gameSocket.emit('game:start', { pin: session.pin })
  }, [session])

  const nextQuestion = useCallback(() => {
    if (session) gameSocket.emit('game:next-question', { pin: session.pin })
  }, [session])

  const revealAnswers = useCallback(() => {
    if (session) gameSocket.emit('game:reveal-answers', { pin: session.pin })
  }, [session])

  const showLeaderboard = useCallback(() => {
    if (session) gameSocket.emit('game:show-leaderboard', { pin: session.pin })
  }, [session])

  const endGame = useCallback(() => {
    if (session) gameSocket.emit('game:end', { pin: session.pin })
  }, [session])

  return {
    session,
    phase,
    isConnecting,
    connectionError,
    players,
    currentQuestion,
    answeredCount,
    answerStats,
    leaderboard,
    startGame,
    nextQuestion,
    revealAnswers,
    showLeaderboard,
    endGame,
  }
}
