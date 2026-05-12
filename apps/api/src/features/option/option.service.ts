import { prisma } from '../../config/database.js'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../user/user.types.js'
import type { CreateOptionBody, UpdateOptionBody } from './option.schemas.js'

const OPTION_SELECT = {
  id: true,
  questionId: true,
  text: true,
  isCorrect: true,
  color: true,
  order: true,
} as const

async function assertQuestionOptionOwnership(questionId: string, user: AuthenticatedUser) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { quiz: { select: { authorId: true } } },
  })
  if (!question) throw new NotFoundError('Pergunta não encontrada')
  if (user.role !== 'ADMIN' && question.quiz.authorId !== user.id) {
    throw new ForbiddenError('Sem permissão para modificar esta pergunta')
  }
}

async function assertOptionOwnership(optionId: string, user: AuthenticatedUser) {
  const option = await prisma.answerOption.findUnique({
    where: { id: optionId },
    select: { questionId: true, question: { select: { quiz: { select: { authorId: true } } } } },
  })
  if (!option) throw new NotFoundError('Opção não encontrada')
  if (user.role !== 'ADMIN' && option.question.quiz.authorId !== user.id) {
    throw new ForbiddenError('Sem permissão para modificar esta opção')
  }
  return option
}

async function getNextOptionOrder(questionId: string): Promise<number> {
  const result = await prisma.answerOption.count({ where: { questionId } })
  return result + 1
}

export async function createOption(
  questionId: string,
  body: CreateOptionBody,
  user: AuthenticatedUser,
) {
  await assertQuestionOptionOwnership(questionId, user)

  const count = await prisma.answerOption.count({ where: { questionId } })
  if (count >= 4) {
    throw new UnprocessableEntityError('Máximo de 4 opções por pergunta atingido')
  }

  const order = body.order ?? (await getNextOptionOrder(questionId))

  if (body.isCorrect) {
    return prisma.$transaction(async (tx) => {
      await tx.answerOption.updateMany({
        where: { questionId },
        data: { isCorrect: false },
      })
      return tx.answerOption.create({
        data: { questionId, text: body.text, isCorrect: true, color: body.color, order },
        select: OPTION_SELECT,
      })
    })
  }

  return prisma.answerOption.create({
    data: { questionId, text: body.text, isCorrect: false, color: body.color, order },
    select: OPTION_SELECT,
  })
}

export async function updateOption(
  id: string,
  body: UpdateOptionBody,
  user: AuthenticatedUser,
) {
  const option = await assertOptionOwnership(id, user)

  if (body.isCorrect) {
    return prisma.$transaction(async (tx) => {
      await tx.answerOption.updateMany({
        where: { questionId: option.questionId, NOT: { id } },
        data: { isCorrect: false },
      })
      return tx.answerOption.update({
        where: { id },
        data: body,
        select: OPTION_SELECT,
      })
    })
  }

  return prisma.answerOption.update({
    where: { id },
    data: body,
    select: OPTION_SELECT,
  })
}

export async function deleteOption(id: string, user: AuthenticatedUser) {
  await assertOptionOwnership(id, user)
  await prisma.answerOption.delete({ where: { id } })
}
