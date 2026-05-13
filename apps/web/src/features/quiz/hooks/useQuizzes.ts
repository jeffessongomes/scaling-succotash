'use client'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { fetchQuizzes } from '../api/quiz.api'
import { quizKeys } from './query-keys'

export function useQuizzes() {
  const { data: session } = useSession()
  const token = session?.accessToken ?? ''

  return useQuery({
    queryKey: quizKeys.lists(),
    queryFn: () => fetchQuizzes(token),
    enabled: !!token,
  })
}
