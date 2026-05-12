import { Router, type Router as IRouter } from 'express'
import { prisma } from '../config/database.js'
import { redis } from '../config/redis.js'

export const healthRouter: IRouter = Router()

healthRouter.get('/', async (_req, res) => {
  let postgresOk = false
  let redisOk = false

  try {
    await prisma.$queryRaw`SELECT 1`
    postgresOk = true
  } catch {}

  try {
    await redis.ping()
    redisOk = true
  } catch {}

  const status = postgresOk && redisOk ? 'ok' : 'degraded'
  const httpStatus = status === 'ok' ? 200 : 503

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services: { postgres: postgresOk, redis: redisOk },
  })
})
