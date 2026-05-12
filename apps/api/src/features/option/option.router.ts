import { Router, type Router as IRouter } from 'express'
import { requireAuth } from '../../shared/middleware/require-auth.js'
import { BadRequestError } from '../../shared/errors/http-errors.js'
import { CreateOptionBodySchema, UpdateOptionBodySchema } from './option.schemas.js'
import { createOption, updateOption, deleteOption } from './option.service.js'

export const optionRouter: IRouter = Router()

optionRouter.post('/questions/:questionId/options', requireAuth, async (req, res, next) => {
  try {
    const result = CreateOptionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const option = await createOption(req.params['questionId'] as string, result.data, req.user!)
    res.status(201).json(option)
  } catch (err) {
    next(err)
  }
})

optionRouter.patch('/options/:id', requireAuth, async (req, res, next) => {
  try {
    const result = UpdateOptionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const option = await updateOption(req.params['id'] as string, result.data, req.user!)
    res.json(option)
  } catch (err) {
    next(err)
  }
})

optionRouter.delete('/options/:id', requireAuth, async (req, res, next) => {
  try {
    await deleteOption(req.params['id'] as string, req.user!)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
