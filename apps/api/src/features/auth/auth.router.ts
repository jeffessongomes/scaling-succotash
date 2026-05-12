import { Router, type Router as IRouter } from 'express'
import { LoginBodySchema, RegisterBodySchema } from './auth.schema.js'
import { createFirstAdmin, validateCredentials } from './auth.service.js'
import { BadRequestError } from '../../shared/errors/http-errors.js'

export const authRouter: IRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = RegisterBodySchema.parse(req.body)
    const user = await createFirstAdmin(body.name, body.email, body.password)
    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const result = LoginBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const user = await validateCredentials(result.data.email, result.data.password)
    res.json(user)
  } catch (err) {
    next(err)
  }
})
