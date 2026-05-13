import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { createElement } from 'react'
import { createQuestion, createQuizDetail } from '@/mocks/quiz'

const { mockReorderQuestion, mockUseSession } = vi.hoisted(() => ({
  mockReorderQuestion: vi.fn(),
  mockUseSession: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  useSession: mockUseSession,
}))

vi.mock('@/features/quiz/api/question.api', () => ({
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  reorderQuestion: mockReorderQuestion,
}))

vi.mock('@/features/quiz/api/option.api', () => ({
  createOption: vi.fn(),
  updateOption: vi.fn(),
  deleteOption: vi.fn(),
}))

const { useQuizEditor } = await import('../useQuizEditor')

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client }, children),
  }
}

const QUIZ_ID = 'quiz-abc'

beforeEach(() => {
  mockUseSession.mockReturnValue({
    data: {
      user: { id: 'user-1', name: 'Prof. Silva', email: 'silva@escola.com.br', role: 'TEACHER' },
      accessToken: 'tok-test',
      expires: '2099-01-01',
    },
    status: 'authenticated',
  })
  mockReorderQuestion.mockResolvedValue({})
})

describe('useQuizEditor — reorderQuestions', () => {
  it('should keep questions in new order when reorder succeeds', async () => {
    const q1 = createQuestion({ id: 'q1', order: 1 })
    const q2 = createQuestion({ id: 'q2', order: 2 })
    const quizDetail = createQuizDetail({ id: QUIZ_ID, questions: [q1, q2] })

    const { client, wrapper } = makeWrapper()
    const { result } = renderHook(() => useQuizEditor(QUIZ_ID), { wrapper })

    client.setQueryData(['quizzes', 'detail', QUIZ_ID], quizDetail)

    const newOrder = [{ ...q2, order: 1 }, { ...q1, order: 2 }]

    await act(async () => {
      await result.current.reorderQuestions([q1, q2], newOrder)
    })

    await waitFor(() => {
      expect(mockReorderQuestion).toHaveBeenCalled()
    })

    expect(result.current.reorderError).toBeNull()
  })

  it('should revert to original order when reorder fails', async () => {
    mockReorderQuestion.mockRejectedValueOnce(new Error('Erro de rede'))

    const q1 = createQuestion({ id: 'q1', order: 1 })
    const q2 = createQuestion({ id: 'q2', order: 2 })
    const quizDetail = createQuizDetail({ id: QUIZ_ID, questions: [q1, q2] })

    const { client, wrapper } = makeWrapper()
    const { result } = renderHook(() => useQuizEditor(QUIZ_ID), { wrapper })

    client.setQueryData(['quizzes', 'detail', QUIZ_ID], quizDetail)

    const newOrder = [{ ...q2, order: 1 }, { ...q1, order: 2 }]

    await act(async () => {
      await result.current.reorderQuestions([q1, q2], newOrder)
    })

    await waitFor(() => {
      expect(result.current.reorderError).toBe(
        'Erro ao reordenar perguntas. Tente novamente.',
      )
    })

    const cached = client.getQueryData<typeof quizDetail>(['quizzes', 'detail', QUIZ_ID])
    expect(cached?.questions[0]?.id).toBe('q1')
    expect(cached?.questions[1]?.id).toBe('q2')
  })
})
