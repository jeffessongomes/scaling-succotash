'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { fetchQuizDetail } from '../api/quiz.api'
import { quizKeys } from './query-keys'

export function useQuizDetail(id: string) {
  const { data: session } = useSession()
  const token = session?.accessToken ?? ''

  return useQuery({
    queryKey: quizKeys.detail(id),
    queryFn: () => fetchQuizDetail(id, token),
    enabled: !!token && !!id,
  })
}
