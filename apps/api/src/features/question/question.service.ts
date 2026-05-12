import { prisma } from '../../config/database.js'
import { ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../user/user.types.js'
import type { CreateQuestionBody, UpdateQuestionBody } from './question.schemas.js'

const QUESTION_SELECT = {
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
} as const

async function assertQuizOwnership(quizId: string, user: AuthenticatedUser) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { authorId: true } })
  if (!quiz) throw new NotFoundError('Quiz não encontrado')
  if (user.role !== 'ADMIN' && quiz.authorId !== user.id) {
    throw new ForbiddenError('Sem permissão para modificar este quiz')
  }
}

async function assertQuestionOwnership(questionId: string, user: AuthenticatedUser) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { quiz: { select: { authorId: true } } },
  })
  if (!question) throw new NotFoundError('Pergunta não encontrada')
  if (user.role !== 'ADMIN' && question.quiz.authorId !== user.id) {
    throw new ForbiddenError('Sem permissão para modificar esta pergunta')
  }
}

async function getNextOrder(quizId: string): Promise<number> {
  const result = await prisma.question.aggregate({
    where: { quizId },
    _max: { order: true },
  })
  return (result._max.order ?? 0) + 1
}

export async function createQuestion(
  quizId: string,
  body: CreateQuestionBody,
  user: AuthenticatedUser,
) {
  await assertQuizOwnership(quizId, user)
  const order = body.order ?? (await getNextOrder(quizId))
  return prisma.question.create({
    data: {
      quizId,
      text: body.text,
      mediaType: body.mediaType,
      mediaUrl: body.mediaUrl,
      timeLimitSecs: body.timeLimitSecs,
      points: body.points,
      order,
    },
    select: QUESTION_SELECT,
  })
}

export async function updateQuestion(
  id: string,
  body: UpdateQuestionBody,
  user: AuthenticatedUser,
) {
  await assertQuestionOwnership(id, user)
  return prisma.question.update({
    where: { id },
    data: body,
    select: QUESTION_SELECT,
  })
}

export async function deleteQuestion(id: string, user: AuthenticatedUser) {
  await assertQuestionOwnership(id, user)
  await prisma.question.delete({ where: { id } })
}

export async function reorderQuestion(id: string, order: number, user: AuthenticatedUser) {
  await assertQuestionOwnership(id, user)
  return prisma.question.update({
    where: { id },
    data: { order },
    select: QUESTION_SELECT,
  })
}
