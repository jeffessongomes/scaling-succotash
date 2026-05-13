import { apiClient } from '@/lib/api-client'

interface CreateSessionBody {
  quizId: string
}

export interface CreateSessionResult {
  sessionId: string
  pin: string
  status: string
  quizTitle: string
  totalQuestions: number
}

export async function createGameSession(
  body: CreateSessionBody,
  token: string,
): Promise<CreateSessionResult> {
  const { data } = await apiClient.post<CreateSessionResult>('/api/game-sessions', body, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}
