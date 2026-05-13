import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, userEvent } from '@/test/test-utils'
import CreateQuizPage from './page'
import { createQuizSummary } from '@/mocks/quiz'

const { mockCreateMutateAsync, mockUseQuizActions, mockRouterPush } = vi.hoisted(() => ({
  mockCreateMutateAsync: vi.fn(),
  mockUseQuizActions: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock('@/features/quiz/hooks/useQuizActions', () => ({
  useQuizActions: mockUseQuizActions,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
  usePathname: vi.fn().mockReturnValue('/quizzes/create'),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}))

beforeEach(() => {
  mockCreateMutateAsync.mockResolvedValue(createQuizSummary())
  mockUseQuizActions.mockReturnValue({
    create: { mutateAsync: mockCreateMutateAsync, isPending: false },
  })
  mockRouterPush.mockReset()
})

describe('CreateQuizPage', () => {
  describe('when form is submitted with valid title', () => {
    it('should redirect to quiz editor page', async () => {
      const user = userEvent.setup()
      const newQuiz = createQuizSummary({ title: 'História do Brasil' })
      mockCreateMutateAsync.mockResolvedValue(newQuiz)

      render(<CreateQuizPage />)

      await user.type(screen.getByTestId('input-quiz-title'), 'História do Brasil')
      await user.click(screen.getByTestId('btn-submit-create-quiz'))

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith(`/quizzes/${newQuiz.id}`)
      })
    })
  })

  describe('when title is empty', () => {
    it('should show inline validation error', async () => {
      const user = userEvent.setup()
      render(<CreateQuizPage />)

      await user.click(screen.getByTestId('btn-submit-create-quiz'))

      expect(await screen.findByText('Título obrigatório')).toBeInTheDocument()
    })
  })

  describe('when mutation is pending', () => {
    it('should disable the submit button', () => {
      mockUseQuizActions.mockReturnValue({
        create: { mutateAsync: mockCreateMutateAsync, isPending: true },
      })

      render(<CreateQuizPage />)

      expect(screen.getByTestId('btn-submit-create-quiz')).toBeDisabled()
    })
  })
})
