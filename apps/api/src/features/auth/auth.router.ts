import { Router, type Router as IRouter } from 'express'
import { LoginBodySchema, RegisterBodySchema } from './auth.schema.js'
import { createFirstAdmin, validateCredentials } from './auth.service.js'

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
    const body = LoginBodySchema.parse(req.body)
    const user = await validateCredentials(body.email, body.password)
    res.json(user)
  } catch (err) {
    next(err)
  }
})
