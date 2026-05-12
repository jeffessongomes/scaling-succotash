import express, { type Express } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { healthRouter } from './routes/health.js'
import { authRouter } from './features/auth/auth.router.js'
import { errorHandler } from './shared/middleware/error-handler.js'

export function createApp(): Express {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: process.env['NEXTAUTH_URL'] ?? '*' }))
  app.use(express.json({ limit: '10mb' }))
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  )

  app.use('/health', healthRouter)
  app.use('/auth', authRouter)
  app.use(errorHandler)

  return app
}
