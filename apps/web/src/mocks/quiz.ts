import type {
  QuizSummary,
  QuizDetail,
  QuestionPublic,
  AnswerOptionPublic,
} from '@/features/quiz/types'

export function createAnswerOption(overrides?: Partial<AnswerOptionPublic>): AnswerOptionPublic {
  return {
    id: crypto.randomUUID(),
    questionId: crypto.randomUUID(),
    text: 'Rio de Janeiro',
    isCorrect: false,
    color: 'RED',
    order: 1,
    ...overrides,
  }
}

export function createQuestion(overrides?: Partial<QuestionPublic>): QuestionPublic {
  const id = crypto.randomUUID()
  return {
    id,
    quizId: crypto.randomUUID(),
    text: 'Qual é a capital do Brasil?',
    mediaType: null,
    mediaUrl: null,
    timeLimitSecs: 30,
    points: 1000,
    order: 1,
    options: [
      createAnswerOption({ questionId: id, text: 'Rio de Janeiro', isCorrect: false, color: 'RED', order: 1 }),
      createAnswerOption({ questionId: id, text: 'Brasília', isCorrect: true, color: 'BLUE', order: 2 }),
      createAnswerOption({ questionId: id, text: 'São Paulo', isCorrect: false, color: 'YELLOW', order: 3 }),
    ],
    ...overrides,
  }
}

export function createQuizSummary(overrides?: Partial<QuizSummary>): QuizSummary {
  return {
    id: crypto.randomUUID(),
    title: 'História do Brasil',
    description: 'Quiz sobre os principais eventos históricos do Brasil',
    coverImage: null,
    isPublished: false,
    authorId: crypto.randomUUID(),
    _count: { questions: 3 },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

export function createQuizDetail(overrides?: Partial<QuizDetail>): QuizDetail {
  const base = createQuizSummary()
  return {
    ...base,
    questions: [createQuestion({ quizId: base.id })],
    ...overrides,
  }
}

export function createPublishedQuiz(overrides?: Partial<QuizSummary>): QuizSummary {
  return createQuizSummary({ isPublished: true, _count: { questions: 3 }, ...overrides })
}

export function createDraftQuiz(overrides?: Partial<QuizSummary>): QuizSummary {
  return createQuizSummary({ isPublished: false, ...overrides })
}

export function createEmptyQuizList(): QuizSummary[] {
  return []
}

export function createQuizListWithItems(): QuizSummary[] {
  return [
    createPublishedQuiz({ title: 'História do Brasil' }),
    createDraftQuiz({ title: 'Geografia do Brasil' }),
  ]
}

export function createQuizWithNoQuestions(overrides?: Partial<QuizSummary>): QuizSummary {
  return createQuizSummary({ _count: { questions: 0 }, ...overrides })
}
