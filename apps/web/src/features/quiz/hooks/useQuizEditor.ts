'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestion,
} from '../api/question.api'
import { createOption, updateOption, deleteOption } from '../api/option.api'
import { quizKeys } from './query-keys'
import type { QuestionPublic } from '../types'
import type { CreateQuestionInput } from '../schemas/question.schema'
import type { CreateOptionInput } from '../schemas/option.schema'

export function useQuizEditor(quizId: string) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const token = session?.accessToken ?? ''
  const [reorderError, setReorderError] = useState<string | null>(null)

  const addQuestion = useMutation({
    mutationFn: (body: CreateQuestionInput) => createQuestion(quizId, body, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  const editQuestion = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateQuestionInput> }) =>
      updateQuestion(id, body, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  const removeQuestion = useMutation({
    mutationFn: (id: string) => deleteQuestion(id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  const reorderQuestions = async (
    questions: QuestionPublic[],
    newOrder: QuestionPublic[],
  ): Promise<void> => {
    setReorderError(null)
    queryClient.setQueryData(quizKeys.detail(quizId), (old: { questions: QuestionPublic[] } | undefined) => {
      if (!old) return old
      return { ...old, questions: newOrder }
    })

    const moved = newOrder.filter((q, i) => questions[i]?.id !== q.id)
    try {
      await Promise.all(moved.map((q) => reorderQuestion(q.id, q.order, token)))
    } catch {
      queryClient.setQueryData(quizKeys.detail(quizId), (old: { questions: QuestionPublic[] } | undefined) => {
        if (!old) return old
        return { ...old, questions }
      })
      setReorderError('Erro ao reordenar perguntas. Tente novamente.')
    }
  }

  const addOption = useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: CreateOptionInput }) =>
      createOption(questionId, body, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  const editOption = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CreateOptionInput> }) =>
      updateOption(id, body, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  const removeOption = useMutation({
    mutationFn: (id: string) => deleteOption(id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) }),
  })

  return {
    addQuestion,
    editQuestion,
    removeQuestion,
    reorderQuestions,
    reorderError,
    addOption,
    editOption,
    removeOption,
  }
}
