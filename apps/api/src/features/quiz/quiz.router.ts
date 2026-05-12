import { Router, type Router as IRouter } from 'express'
import { requireAuth } from '../../shared/middleware/require-auth.js'
import { BadRequestError } from '../../shared/errors/http-errors.js'
import {
  CreateQuizBodySchema,
  UpdateQuizBodySchema,
  PublishQuizBodySchema,
} from './quiz.schemas.js'
import {
  createQuiz,
  listQuizzes,
  getQuizDetail,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
} from './quiz.service.js'

export const quizRouter: IRouter = Router()

quizRouter.post('/quizzes', requireAuth, async (req, res, next) => {
  try {
    const result = CreateQuizBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const quiz = await createQuiz(result.data, req.user!)
    res.status(201).json(quiz)
  } catch (err) {
    next(err)
  }
})

quizRouter.get('/quizzes', requireAuth, async (req, res, next) => {
  try {
    const quizzes = await listQuizzes(req.user!)
    res.json(quizzes)
  } catch (err) {
    next(err)
  }
})

quizRouter.get('/quizzes/:id', requireAuth, async (req, res, next) => {
  try {
    const quiz = await getQuizDetail(req.params['id'] as string)
    res.json(quiz)
  } catch (err) {
    next(err)
  }
})

quizRouter.patch('/quizzes/:id', requireAuth, async (req, res, next) => {
  try {
    const result = UpdateQuizBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const quiz = await updateQuiz(req.params['id'] as string, result.data, req.user!)
    res.json(quiz)
  } catch (err) {
    next(err)
  }
})

quizRouter.delete('/quizzes/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteQuiz(req.params['id'] as string, req.user!)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

quizRouter.patch('/quizzes/:id/publish', requireAuth, async (req, res, next) => {
  try {
    const result = PublishQuizBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const quiz = await publishQuiz(req.params['id'] as string, result.data, req.user!)
    res.json(quiz)
  } catch (err) {
    next(err)
  }
})
