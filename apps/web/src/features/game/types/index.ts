import type { GamePhase } from '@/types'

export interface GameSession {
  pin: string
  quizId: string
  quizTitle: string
  totalQuestions: number
  status: GamePhase
}

export interface GamePlayer {
  nickname: string
  avatarId: string
}

export interface QuestionState {
  index: number
  total: number
  text: string
  timeLimitSecs: number
  points: number
}

export interface AnswerStats {
  correctOptionId: string
  stats: Record<string, number>
}

export interface LeaderboardEntry {
  nickname: string
  avatarId: string
  score: number
  rank: number
}
