import { apiClient } from '@/lib/api-client'
import type { QuizSummary, QuizDetail } from '../types'
import type { CreateQuizInput, UpdateQuizInput } from '../schemas/quiz.schema'

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function fetchQuizzes(token: string): Promise<QuizSummary[]> {
  const { data } = await apiClient.get<QuizSummary[]>('/api/quizzes', {
    headers: authHeader(token),
  })
  return data
}

export async function fetchQuizDetail(id: string, token: string): Promise<QuizDetail> {
  const { data } = await apiClient.get<QuizDetail>(`/api/quizzes/${id}`, {
    headers: authHeader(token),
  })
  return data
}

export async function createQuiz(body: CreateQuizInput, token: string): Promise<QuizSummary> {
  const { data } = await apiClient.post<QuizSummary>('/api/quizzes', body, {
    headers: authHeader(token),
  })
  return data
}

export async function updateQuiz(
  id: string,
  body: UpdateQuizInput,
  token: string,
): Promise<QuizSummary> {
  const { data } = await apiClient.patch<QuizSummary>(`/api/quizzes/${id}`, body, {
    headers: authHeader(token),
  })
  return data
}

export async function deleteQuiz(id: string, token: string): Promise<void> {
  await apiClient.delete(`/api/quizzes/${id}`, { headers: authHeader(token) })
}

export async function publishQuiz(
  id: string,
  isPublished: boolean,
  token: string,
): Promise<QuizSummary> {
  const { data } = await apiClient.patch<QuizSummary>(
    `/api/quizzes/${id}/publish`,
    { isPublished },
    { headers: authHeader(token) },
  )
  return data
}
