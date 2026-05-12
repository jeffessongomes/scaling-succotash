export type Role = 'TEACHER' | 'ADMIN'

export type SessionStatus =
  | 'LOBBY'
  | 'ACTIVE'
  | 'QUESTION'
  | 'REVEAL'
  | 'LEADERBOARD'
  | 'FINISHED'

export type MediaType = 'IMAGE' | 'VIDEO'

export type OptionColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN'

export interface Quiz {
  id: string
  title: string
  description?: string
  coverImage?: string
  isPublished: boolean
  authorId: string
  createdAt: Date
  updatedAt: Date
}

export interface Question {
  id: string
  quizId: string
  text: string
  mediaType?: MediaType
  mediaUrl?: string
  timeLimitSecs: number
  points: number
  order: number
  options: AnswerOption[]
}

export interface AnswerOption {
  id: string
  questionId: string
  text: string
  isCorrect: boolean
  color: OptionColor
  order: number
}

export interface GameSession {
  id: string
  quizId: string
  pin: string
  status: SessionStatus
  currentQuestionIndex: number
  startedAt?: Date
  endedAt?: Date
}

export interface GameParticipant {
  id: string
  sessionId: string
  nickname: string
  avatarId: string
  score: number
}

export interface GameAnswer {
  id: string
  sessionId: string
  participantId: string
  questionId: string
  optionId: string
  isCorrect: boolean
  pointsEarned: number
  answeredInMs: number
}
