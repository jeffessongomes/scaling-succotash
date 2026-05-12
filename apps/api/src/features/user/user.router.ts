import { Router, type Router as IRouter } from 'express'
import { requireAuth } from '../../shared/middleware/require-auth.js'
import { requireAdmin } from '../../shared/middleware/require-admin.js'
import { CreateUserBodySchema, UpdateUserBodySchema } from './user.schemas.js'
import { createUser, getMe, updateUser, deleteUser } from './user.service.js'
import { BadRequestError } from '../../shared/errors/http-errors.js'

export const userRouter: IRouter = Router()

userRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = CreateUserBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const user = await createUser(result.data)
    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
})

userRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getMe(req.user!.id)
    res.json(user)
  } catch (err) {
    next(err)
  }
})

userRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = UpdateUserBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const user = await updateUser(req.params['id'] as string, result.data, req.user!)
    res.json(user)
  } catch (err) {
    next(err)
  }
})

userRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await deleteUser(req.params['id'] as string)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
