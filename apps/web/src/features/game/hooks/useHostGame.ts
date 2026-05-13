import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import type { GamePhase } from '@/types'
import type { GameSession, GamePlayer, QuestionState, AnswerStats, LeaderboardEntry } from '../types'

interface SessionCreatedPayload {
  pin: string
  quizTitle: string
  totalQuestions: number
}

interface PlayerJoinedPayload {
  nickname: string
  avatarId: string
  totalPlayers: number
}

interface QuestionStartPayload {
  question: { text: string; timeLimitSecs: number; points: number }
  questionIndex: number
  totalQuestions: number
}

interface AnswerReceivedPayload {
  totalAnswered: number
  totalPlayers: number
}

interface AnswersRevealedPayload {
  correctOptionId: string
  stats: Record<string, number>
}

interface LeaderboardPayload {
  top3: LeaderboardEntry[]
}

interface SessionEndedPayload {
  finalLeaderboard: LeaderboardEntry[]
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
  const [session, setSession] = useState<GameSession | null>(null)
  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [isConnecting, setIsConnecting] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuestionState | null>(null)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [answerStats, setAnswerStats] = useState<AnswerStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    socket.connect()
    socket.emit('host:create-session', { quizId })

    function onSessionCreated(payload: SessionCreatedPayload) {
      setSession({
        pin: payload.pin,
        quizId,
        quizTitle: payload.quizTitle,
        totalQuestions: payload.totalQuestions,
        status: 'lobby',
      })
      setPhase('lobby')
      setIsConnecting(false)
    }

    function onPlayerJoined(payload: PlayerJoinedPayload) {
      setPlayers((prev) => [...prev, { nickname: payload.nickname, avatarId: payload.avatarId }])
    }

    function onQuestionStart(payload: QuestionStartPayload) {
      setPhase('question')
      setAnsweredCount(0)
      setAnswerStats(null)
      setCurrentQuestion({
        index: payload.questionIndex,
        total: payload.totalQuestions,
        text: payload.question.text,
        timeLimitSecs: payload.question.timeLimitSecs,
        points: payload.question.points,
      })
    }

    function onAnswerReceived(payload: AnswerReceivedPayload) {
      setAnsweredCount(payload.totalAnswered)
    }

    function onAnswersRevealed(payload: AnswersRevealedPayload) {
      setPhase('results')
      setAnswerStats({ correctOptionId: payload.correctOptionId, stats: payload.stats })
    }

    function onLeaderboard(payload: LeaderboardPayload) {
      setPhase('leaderboard')
      setLeaderboard(payload.top3)
    }

    function onSessionEnded(payload: SessionEndedPayload) {
      setPhase('finished')
      setLeaderboard(payload.finalLeaderboard)
    }

    function onSessionError(payload: SessionErrorPayload) {
      setConnectionError(payload.message)
      setIsConnecting(false)
    }

    socket.on('session:created', onSessionCreated)
    socket.on('session:player-joined', onPlayerJoined)
    socket.on('session:question-start', onQuestionStart)
    socket.on('session:answer-received', onAnswerReceived)
    socket.on('session:answers-revealed', onAnswersRevealed)
    socket.on('session:leaderboard', onLeaderboard)
    socket.on('session:ended', onSessionEnded)
    socket.on('session:error', onSessionError)

    return () => {
      socket.off('session:created', onSessionCreated)
      socket.off('session:player-joined', onPlayerJoined)
      socket.off('session:question-start', onQuestionStart)
      socket.off('session:answer-received', onAnswerReceived)
      socket.off('session:answers-revealed', onAnswersRevealed)
      socket.off('session:leaderboard', onLeaderboard)
      socket.off('session:ended', onSessionEnded)
      socket.off('session:error', onSessionError)
      socket.disconnect()
    }
  }, [quizId])

  const startGame = useCallback(() => {
    if (session) socket.emit('game:start', { pin: session.pin })
  }, [session])

  const nextQuestion = useCallback(() => {
    if (session) socket.emit('game:next-question', { pin: session.pin })
  }, [session])

  const revealAnswers = useCallback(() => {
    if (session) socket.emit('game:reveal-answers', { pin: session.pin })
  }, [session])

  const showLeaderboard = useCallback(() => {
    if (session) socket.emit('game:show-leaderboard', { pin: session.pin })
  }, [session])

  const endGame = useCallback(() => {
    if (session) socket.emit('game:end', { pin: session.pin })
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
