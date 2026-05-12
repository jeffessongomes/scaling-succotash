export type SessionStatus = 'LOBBY' | 'ACTIVE' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'FINISHED'

export const MAX_PARTICIPANTS = 60

export interface CreateSessionResponse {
  sessionId: string
  pin: string
  status: 'LOBBY'
  quizTitle: string
  totalQuestions: number
}

export interface GetSessionByPinResponse {
  sessionId: string
  pin: string
  status: SessionStatus
  currentQuestionIndex: number
  quizId: string
  participantCount: number
}

export interface GameSessionState {
  sessionId: string
  pin: string
  quizId: string
  authorId: string
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
