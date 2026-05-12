import { apiClient } from '@/lib/api-client'
import type { AnswerOptionPublic } from '../types'
import type { CreateOptionInput } from '../schemas/option.schema'

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function createOption(
  questionId: string,
  body: CreateOptionInput,
  token: string,
): Promise<AnswerOptionPublic> {
  const { data } = await apiClient.post<AnswerOptionPublic>(
    `/api/questions/${questionId}/options`,
    body,
    { headers: authHeader(token) },
  )
  return data
}

export async function updateOption(
  id: string,
  body: Partial<CreateOptionInput>,
  token: string,
): Promise<AnswerOptionPublic> {
  const { data } = await apiClient.patch<AnswerOptionPublic>(`/api/options/${id}`, body, {
    headers: authHeader(token),
  })
  return data
}

export async function deleteOption(id: string, token: string): Promise<void> {
  await apiClient.delete(`/api/options/${id}`, { headers: authHeader(token) })
}
