export type SessionStatus = 'LOBBY' | 'ACTIVE' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'FINISHED'

export interface GameSessionState {
  sessionId: string
  pin: string
  quizId: string
  hostSocketId: string
  status: SessionStatus
  currentQuestionIndex: number
  questionStartedAt: number | null
  hostDisconnectedAt: number | null
  participants: Record<string, ParticipantState>
}

export interface ParticipantState {
  id: string
  nickname: string
  avatarId: string
  score: number
  socketId: string
  isConnected: boolean
}

export interface ParticipantScore {
  id: string
  nickname: string
  avatarId: string
  score: number
  rank: number
}

export interface PlayerJoinPayload {
  pin: string
  nickname: string
  avatarId: string
}

export interface PlayerAnswerPayload {
  pin: string
  questionId: string
  optionId: string
  answeredInMs: number
}

export interface HostActionPayload {
  pin: string
}

export interface AnswerRecord {
  optionId: string
  answeredInMs: number
}
