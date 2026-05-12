import { prisma } from '../../config/database.js'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../user/user.types.js'
import type { CreateQuizBody, UpdateQuizBody, PublishQuizBody, QuizSummary, QuizDetail } from './quiz.schemas.js'

const QUIZ_SUMMARY_SELECT = {
  id: true,
  title: true,
  description: true,
  coverImage: true,
  isPublished: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { questions: true } },
} as const

const QUIZ_DETAIL_SELECT = {
  ...QUIZ_SUMMARY_SELECT,
  questions: {
    select: {
      id: true,
      quizId: true,
      text: true,
      mediaType: true,
      mediaUrl: true,
      timeLimitSecs: true,
      points: true,
      order: true,
      options: {
        select: {
          id: true,
          questionId: true,
          text: true,
          isCorrect: true,
          color: true,
          order: true,
        },
        orderBy: { order: 'asc' as const },
      },
    },
    orderBy: { order: 'asc' as const },
  },
} as const

async function assertQuizOwnership(quizId: string, user: AuthenticatedUser): Promise<void> {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { authorId: true } })
  if (!quiz) throw new NotFoundError('Quiz não encontrado')
  if (user.role !== 'ADMIN' && quiz.authorId !== user.id) {
    throw new ForbiddenError('Sem permissão para modificar este quiz')
  }
}

export async function createQuiz(body: CreateQuizBody, user: AuthenticatedUser): Promise<QuizSummary> {
  return prisma.quiz.create({
    data: {
      title: body.title,
      description: body.description,
      coverImage: body.coverImage,
      authorId: user.id,
    },
    select: QUIZ_SUMMARY_SELECT,
  }) as Promise<QuizSummary>
}

export async function listQuizzes(user: AuthenticatedUser): Promise<QuizSummary[]> {
  const where = user.role === 'ADMIN' ? {} : { authorId: user.id }
  return prisma.quiz.findMany({
    where,
    select: QUIZ_SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  }) as Promise<QuizSummary[]>
}

export async function getQuizDetail(id: string): Promise<QuizDetail> {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: QUIZ_DETAIL_SELECT,
  })
  if (!quiz) throw new NotFoundError('Quiz não encontrado')
  return quiz as unknown as QuizDetail
}

export async function updateQuiz(
  id: string,
  body: UpdateQuizBody,
  user: AuthenticatedUser,
): Promise<QuizSummary> {
  await assertQuizOwnership(id, user)
  return prisma.quiz.update({
    where: { id },
    data: body,
    select: QUIZ_SUMMARY_SELECT,
  }) as Promise<QuizSummary>
}

export async function deleteQuiz(id: string, user: AuthenticatedUser): Promise<void> {
  await assertQuizOwnership(id, user)
  await prisma.$transaction([
    prisma.gameSession.updateMany({
      where: { quizId: id, status: { not: 'FINISHED' } },
      data: { status: 'FINISHED' },
    }),
    prisma.quiz.delete({ where: { id } }),
  ])
}

export async function publishQuiz(
  id: string,
  body: PublishQuizBody,
  user: AuthenticatedUser,
): Promise<QuizSummary> {
  await assertQuizOwnership(id, user)

  if (body.isPublished) {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      select: {
        questions: {
          select: { _count: { select: { options: true } } },
        },
      },
    })
    if (!quiz) throw new NotFoundError('Quiz não encontrado')

    const isEligible = quiz.questions.some((q) => q._count.options >= 2)
    if (!isEligible) {
      throw new UnprocessableEntityError(
        'O quiz precisa ter ao menos 1 pergunta com no mínimo 2 opções para ser publicado',
      )
    }
  }

  return prisma.quiz.update({
    where: { id },
    data: { isPublished: body.isPublished },
    select: QUIZ_SUMMARY_SELECT,
  }) as Promise<QuizSummary>
}
