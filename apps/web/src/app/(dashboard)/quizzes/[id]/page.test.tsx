import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, act } from '@testing-library/react'
import { Suspense } from 'react'
import { render, userEvent } from '@/test/test-utils'
import QuizEditorPage from './page'
import { createQuizDetail } from '@/mocks/quiz'

const { mockUseQuizDetail, mockUseQuizActions, mockUseQuizEditor, mockPublishMutate } = vi.hoisted(
  () => {
    const mockPublishMutate = vi.fn()
    return {
      mockUseQuizDetail: vi.fn(),
      mockUseQuizActions: vi.fn(),
      mockUseQuizEditor: vi.fn(),
      mockPublishMutate,
    }
  },
)

vi.mock('@/features/quiz/hooks/useQuizDetail', () => ({
  useQuizDetail: mockUseQuizDetail,
}))

vi.mock('@/features/quiz/hooks/useQuizActions', () => ({
  useQuizActions: mockUseQuizActions,
}))

vi.mock('@/features/quiz/hooks/useQuizEditor', () => ({
  useQuizEditor: mockUseQuizEditor,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn() }),
  usePathname: vi.fn().mockReturnValue('/quizzes/quiz-123'),
  useParams: vi.fn().mockReturnValue({}),
}))

vi.mock('next-auth/react', () => ({
  useSession: vi.fn().mockReturnValue({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}))

const QUIZ_ID = 'quiz-123'

function makeEditorMock() {
  return {
    addQuestion: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
    removeQuestion: { mutate: vi.fn(), isPending: false },
    reorderQuestions: vi.fn(),
    reorderError: null,
    addOption: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
    editOption: { mutateAsync: vi.fn().mockResolvedValue({}) },
    removeOption: { mutate: vi.fn(), isPending: false },
  }
}

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <QuizEditorPage params={Promise.resolve({ id: QUIZ_ID })} />
      </Suspense>,
    )
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseQuizActions.mockReturnValue({
    publish: { mutate: mockPublishMutate, isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  })
  mockUseQuizEditor.mockReturnValue(makeEditorMock())
})

describe('QuizEditorPage', () => {
  describe('when page loads', () => {
    it('should render quiz title, status badge and add question button', async () => {
      const quiz = createQuizDetail({ id: QUIZ_ID, title: 'História do Brasil' })
      mockUseQuizDetail.mockReturnValue({ data: quiz, isLoading: false, error: null })

      await renderPage()

      expect(screen.getByText('História do Brasil')).toBeInTheDocument()
      expect(screen.getByTestId('badge-quiz-status')).toBeInTheDocument()
      expect(screen.getByTestId('btn-add-question')).toBeInTheDocument()
    })
  })

  describe('when add question is clicked', () => {
    it('should show QuestionForm', async () => {
      const user = userEvent.setup()
      const quiz = createQuizDetail({ id: QUIZ_ID })
      mockUseQuizDetail.mockReturnValue({ data: quiz, isLoading: false, error: null })

      await renderPage()

      await user.click(screen.getByTestId('btn-add-question'))

      expect(screen.getByTestId('btn-submit-question')).toBeInTheDocument()
    })
  })

  describe('when question is deleted', () => {
    it('should call removeQuestion mutation with question id', async () => {
      const user = userEvent.setup()
      const editor = makeEditorMock()
      mockUseQuizEditor.mockReturnValue(editor)
      const quiz = createQuizDetail({ id: QUIZ_ID })
      mockUseQuizDetail.mockReturnValue({ data: quiz, isLoading: false, error: null })

      await renderPage()

      const questionId = quiz.questions[0]!.id
      await user.click(screen.getByTestId(`btn-delete-question-${questionId}`))

      expect(editor.removeQuestion.mutate).toHaveBeenCalledWith(questionId)
    })
  })

  describe('when publish is clicked with 0 questions', () => {
    it('should have publish button disabled', async () => {
      const quiz = createQuizDetail({ id: QUIZ_ID, questions: [] })
      mockUseQuizDetail.mockReturnValue({ data: quiz, isLoading: false, error: null })

      await renderPage()

      expect(screen.getByTestId('btn-publish-quiz')).toBeDisabled()
    })
  })

  describe('when publish is clicked with questions', () => {
    it('should call publish mutation', async () => {
      const user = userEvent.setup()
      const quiz = createQuizDetail({ id: QUIZ_ID, isPublished: false })
      mockUseQuizDetail.mockReturnValue({ data: quiz, isLoading: false, error: null })

      await renderPage()

      await user.click(screen.getByTestId('btn-publish-quiz'))

      expect(mockPublishMutate).toHaveBeenCalledWith({ id: QUIZ_ID, isPublished: true })
    })
  })
})
