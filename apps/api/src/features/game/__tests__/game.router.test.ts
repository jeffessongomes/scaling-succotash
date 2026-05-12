import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { AuthenticatedUser } from '../../user/user.types.js'
import {
  UnauthorizedError,
  UnprocessableEntityError,
  NotFoundError,
  ConflictError,
} from '../../../shared/errors/http-errors.js'

const teacherUser: AuthenticatedUser = {
  id: 'user-teacher-001',
  name: 'Ana Professora',
  email: 'ana@escola.edu.br',
  role: 'TEACHER',
}

const { mockRequireAuth } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
}))

const { mockGameService } = vi.hoisted(() => ({
  mockGameService: {
    createSession: vi.fn(),
    getSessionByPin: vi.fn(),
    finalizeSession: vi.fn(),
  },
}))

vi.mock('../../../shared/middleware/require-auth.js', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('../game.service.js', () => mockGameService)

const { createApp } = await import('../../../app.js')

describe('game.router', () => {
  let app: ReturnType<typeof createApp>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRequireAuth.mockImplementation((req, _res, next) => {
      req.user = teacherUser
      next()
    })
    app = createApp()
  })

  describe('POST /api/sessions', () => {
    it('should return 201 with session data when quiz is published', async () => {
      mockGameService.createSession.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        quizTitle: 'Capitais do Brasil',
        totalQuestions: 5,
      })

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(201)
      expect(res.body.pin).toBe('482971')
      expect(res.body.status).toBe('LOBBY')
    })

    it('should return 400 when body is invalid', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer token')
        .send({})

      expect(res.status).toBe(400)
    })

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockImplementationOnce((_req, _res, next) => {
        next(new UnauthorizedError())
      })

      const res = await request(app)
        .post('/api/sessions')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(401)
    })

    it('should return 422 when quiz is not published', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new UnprocessableEntityError('Quiz não está publicado'),
      )

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(422)
    })

    it('should return 404 when quiz does not exist', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new NotFoundError('Quiz não encontrado'),
      )

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-nonexistent' })

      expect(res.status).toBe(404)
    })

    it('should return 409 when there is already an active session for the quiz', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new ConflictError('Já existe uma sessão ativa'),
      )

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/sessions/:pin', () => {
    it('should return 200 with session state when PIN exists', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/sessions/482971')

      expect(res.status).toBe(200)
      expect(res.body.pin).toBe('482971')
    })

    it('should return 404 when PIN does not exist', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce(null)

      const res = await request(app).get('/api/sessions/000000')

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/sessions/:pin', () => {
    it('should return 204 and finalize the session when authenticated', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })
      mockGameService.finalizeSession.mockResolvedValueOnce(undefined)

      const res = await request(app)
        .delete('/api/sessions/482971')
        .set('Authorization', 'Bearer token')

      expect(res.status).toBe(204)
      expect(mockGameService.finalizeSession).toHaveBeenCalledOnce()
    })

    it('should return 404 when session does not exist', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce(null)

      const res = await request(app)
        .delete('/api/sessions/000000')
        .set('Authorization', 'Bearer token')

      expect(res.status).toBe(404)
    })
  })
})
