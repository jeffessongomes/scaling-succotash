'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { createQuiz, updateQuiz, deleteQuiz, publishQuiz } from '../api/quiz.api'
import { quizKeys } from './query-keys'
import type { CreateQuizInput } from '../schemas/quiz.schema'

export function useQuizActions() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const token = session?.accessToken ?? ''

  const create = useMutation({
    mutationFn: (body: CreateQuizInput) => createQuiz(body, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.lists() }),
  })

  const update = useMutation({
    mutationFn: ({ id, title, description }: { id: string; title?: string; description?: string | null }) =>
      updateQuiz(id, { title, description }, token),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() })
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(id) })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteQuiz(id, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quizKeys.lists() }),
  })

  const publish = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      publishQuiz(id, isPublished, token),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: quizKeys.lists() })
      queryClient.invalidateQueries({ queryKey: quizKeys.detail(id) })
    },
  })

  return { create, update, remove, publish }
}
