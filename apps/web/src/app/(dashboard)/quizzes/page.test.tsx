import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { render, userEvent } from '@/test/test-utils'
import QuizzesPage from './page'
import {
  createPublishedQuiz,
  createDraftQuiz,
  createQuizWithNoQuestions,
  createEmptyQuizList,
} from '@/mocks/quiz'

const { mockUseQuizzes, mockPublishMutateAsync, mockRemoveMutateAsync } = vi.hoisted(() => ({
  mockUseQuizzes: vi.fn(),
  mockPublishMutateAsync: vi.fn(),
  mockRemoveMutateAsync: vi.fn(),
}))

vi.mock('@/features/quiz/hooks/useQuizzes', () => ({
  useQuizzes: mockUseQuizzes,
}))

vi.mock('@/features/quiz/hooks/useQuizActions', () => ({
  useQuizActions: vi.fn(() => ({
    publish: { mutateAsync: mockPublishMutateAsync, isPending: false },
    remove: { mutateAsync: mockRemoveMutateAsync, isPending: false },
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/quizzes'),
  useParams: vi.fn().mockReturnValue({}),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}))

beforeEach(() => {
  mockPublishMutateAsync.mockResolvedValue({})
  mockRemoveMutateAsync.mockResolvedValue({})
})

describe('QuizzesPage', () => {
  describe('when quizzes load successfully', () => {
    it('should render quiz list with status badges and action buttons', () => {
      const quizzes = [
        createPublishedQuiz({ title: 'História do Brasil' }),
        createDraftQuiz({ title: 'Geografia do Brasil' }),
      ]
      mockUseQuizzes.mockReturnValue({ data: quizzes, isLoading: false, error: null, refetch: vi.fn() })

      render(<QuizzesPage />)

      expect(screen.getByText('História do Brasil')).toBeInTheDocument()
      expect(screen.getByText('Geografia do Brasil')).toBeInTheDocument()
      expect(screen.getByTestId(`badge-quiz-status-${quizzes[0]!.id}`)).toHaveTextContent('Publicado')
      expect(screen.getByTestId(`badge-quiz-status-${quizzes[1]!.id}`)).toHaveTextContent('Rascunho')
      expect(screen.getByTestId(`btn-delete-quiz-${quizzes[0]!.id}`)).toBeInTheDocument()
    })
  })

  describe('when quiz list is empty', () => {
    it('should show empty state with CTA', () => {
      mockUseQuizzes.mockReturnValue({
        data: createEmptyQuizList(),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      render(<QuizzesPage />)

      expect(screen.getByText('Criar seu primeiro quiz')).toBeInTheDocument()
    })
  })

  describe('when data is loading', () => {
    it('should show skeleton', () => {
      mockUseQuizzes.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })

      render(<QuizzesPage />)

      expect(screen.getByTestId('quizzes-skeleton')).toBeInTheDocument()
    })
  })

  describe('when fetch fails', () => {
    it('should show error state with retry button', () => {
      mockUseQuizzes.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
      })

      render(<QuizzesPage />)

      expect(screen.getByText('Erro ao carregar quizzes.')).toBeInTheDocument()
      expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
    })
  })

  describe('when delete is clicked', () => {
    it('should show confirmation dialog', async () => {
      const user = userEvent.setup()
      const quiz = createDraftQuiz({ title: 'Quiz para deletar' })
      mockUseQuizzes.mockReturnValue({ data: [quiz], isLoading: false, error: null, refetch: vi.fn() })

      render(<QuizzesPage />)

      await user.click(screen.getByTestId(`btn-delete-quiz-${quiz.id}`))

      expect(await screen.findByTestId('modal-confirm-delete')).toBeInTheDocument()
    })
  })

  describe('when delete is cancelled', () => {
    it('should not call remove mutation', async () => {
      const user = userEvent.setup()
      const quiz = createDraftQuiz({ title: 'Quiz a manter' })
      mockUseQuizzes.mockReturnValue({ data: [quiz], isLoading: false, error: null, refetch: vi.fn() })

      render(<QuizzesPage />)

      await user.click(screen.getByTestId(`btn-delete-quiz-${quiz.id}`))
      await user.click(await screen.findByTestId('btn-cancel-delete'))

      expect(mockRemoveMutateAsync).not.toHaveBeenCalled()
    })
  })

  describe('when publish is clicked on quiz with 0 questions', () => {
    it('should show error message', async () => {
      const user = userEvent.setup()
      const quiz = createQuizWithNoQuestions({ title: 'Quiz vazio' })
      mockUseQuizzes.mockReturnValue({ data: [quiz], isLoading: false, error: null, refetch: vi.fn() })

      render(<QuizzesPage />)

      await user.click(screen.getByTestId(`btn-publish-quiz-${quiz.id}`))

      expect(
        await screen.findByText('O quiz precisa ter pelo menos 1 pergunta para ser publicado'),
      ).toBeInTheDocument()
    })
  })
})
