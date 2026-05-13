import { apiClient } from '@/lib/api-client'
import type { QuestionPublic } from '../types'
import type { CreateQuestionInput } from '../schemas/question.schema'

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function createQuestion(
  quizId: string,
  body: CreateQuestionInput,
  token: string,
): Promise<QuestionPublic> {
  const { data } = await apiClient.post<QuestionPublic>(
    `/api/quizzes/${quizId}/questions`,
    body,
    { headers: authHeader(token) },
  )
  return data
}

export async function updateQuestion(
  id: string,
  body: Partial<CreateQuestionInput>,
  token: string,
): Promise<QuestionPublic> {
  const { data } = await apiClient.patch<QuestionPublic>(`/api/questions/${id}`, body, {
    headers: authHeader(token),
  })
  return data
}

export async function deleteQuestion(id: string, token: string): Promise<void> {
  await apiClient.delete(`/api/questions/${id}`, { headers: authHeader(token) })
}

export async function reorderQuestion(
  id: string,
  order: number,
  token: string,
): Promise<QuestionPublic> {
  const { data } = await apiClient.patch<QuestionPublic>(
    `/api/questions/${id}/reorder`,
    { order },
    { headers: authHeader(token) },
  )
  return data
}
