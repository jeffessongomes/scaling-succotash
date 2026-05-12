import { Router, type Router as IRouter } from 'express'
import { requireAuth } from '../../shared/middleware/require-auth.js'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js'
import { CreateSessionBodySchema } from './game.schemas.js'
import { createSession, getSessionByPin, getSessionById, finalizeSession } from './game.service.js'

export const gameRouter: IRouter = Router()

gameRouter.post('/game-sessions', requireAuth, async (req, res, next) => {
  try {
    const result = CreateSessionBodySchema.safeParse(req.body)
    if (!result.success) {
      next(new BadRequestError('Dados de entrada inválidos'))
      return
    }
    const session = await createSession(result.data, req.user!.id, '')
    res.status(201).json(session)
  } catch (err) {
    next(err)
  }
})

gameRouter.get('/game-sessions/:pin', async (req, res, next) => {
  try {
    const session = await getSessionByPin(req.params['pin'] as string)
    if (!session || !(['LOBBY', 'ACTIVE'] as const).includes(session.status as 'LOBBY' | 'ACTIVE')) {
      next(new NotFoundError('Sessão não encontrada ou indisponível'))
      return
    }
    const { hostSocketId: _host, hostDisconnectedAt: _hda, participants, ...rest } = session
    res.json({ ...rest, participantCount: Object.keys(participants).length })
  } catch (err) {
    next(err)
  }
})

gameRouter.delete('/game-sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await getSessionById(req.params['id'] as string)
    if (!session) {
      next(new NotFoundError('Sessão não encontrada'))
      return
    }
    if (session.authorId !== req.user!.id) {
      next(new ForbiddenError('Apenas o criador da sessão pode encerrá-la'))
      return
    }
    await finalizeSession(session)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
