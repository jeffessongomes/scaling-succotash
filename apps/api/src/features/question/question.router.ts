import { Router, type Router as IRouter } from 'express'
import { requireAuth } from '../../shared/middleware/require-auth.js'
import { BadRequestError } from '../../shared/errors/http-errors.js'
import {
  CreateQuestionBodySchema,
  UpdateQuestionBodySchema,
  ReorderQuestionBodySchema,
} from './question.schemas.js'
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestion,
} from './question.service.js'

export const questionRouter: IRouter = Router()

questionRouter.post('/quizzes/:quizId/questions', requireAuth, async (req, res, next) => {
  try {
    const result = CreateQuestionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const question = await createQuestion(req.params['quizId'] as string, result.data, req.user!)
    res.status(201).json(question)
  } catch (err) {
    next(err)
  }
})

questionRouter.patch('/questions/:id', requireAuth, async (req, res, next) => {
  try {
    const result = UpdateQuestionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const question = await updateQuestion(req.params['id'] as string, result.data, req.user!)
    res.json(question)
  } catch (err) {
    next(err)
  }
})

questionRouter.delete('/questions/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteQuestion(req.params['id'] as string, req.user!)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

questionRouter.patch('/questions/:id/reorder', requireAuth, async (req, res, next) => {
  try {
    const result = ReorderQuestionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const question = await reorderQuestion(req.params['id'] as string, result.data.order, req.user!)
    res.json(question)
  } catch (err) {
    next(err)
  }
})
