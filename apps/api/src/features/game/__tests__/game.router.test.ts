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
    getSessionById: vi.fn(),
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

  describe('POST /api/game-sessions', () => {
    it('should return 201 with session data when quiz is published', async () => {
      mockGameService.createSession.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        quizTitle: 'Capitais do Brasil',
        totalQuestions: 5,
      })

      const res = await request(app)
        .post('/api/game-sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(201)
      expect(res.body.pin).toBe('482971')
      expect(res.body.status).toBe('LOBBY')
    })

    it('should return 400 when body is invalid', async () => {
      const res = await request(app)
        .post('/api/game-sessions')
        .set('Authorization', 'Bearer token')
        .send({})

      expect(res.status).toBe(400)
    })

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockImplementationOnce((_req, _res, next) => {
        next(new UnauthorizedError())
      })

      const res = await request(app)
        .post('/api/game-sessions')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(401)
    })

    it('should return 422 when quiz is not published', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new UnprocessableEntityError('Quiz não está publicado'),
      )

      const res = await request(app)
        .post('/api/game-sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(422)
    })

    it('should return 404 when quiz does not exist', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new NotFoundError('Quiz não encontrado'),
      )

      const res = await request(app)
        .post('/api/game-sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-nonexistent' })

      expect(res.status).toBe(404)
    })

    it('should return 409 when there is already an active session for the quiz', async () => {
      mockGameService.createSession.mockRejectedValueOnce(
        new ConflictError('Já existe uma sessão ativa'),
      )

      const res = await request(app)
        .post('/api/game-sessions')
        .set('Authorization', 'Bearer token')
        .send({ quizId: 'quiz-abc' })

      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/game-sessions/:pin', () => {
    it('should return 200 with session data when PIN exists and status is LOBBY', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: { 'p-1': { id: 'p-1', nickname: 'João', avatarId: '1', score: 0, socketId: 's1', isConnected: true } },
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(200)
      expect(res.body.pin).toBe('482971')
      expect(res.body.participantCount).toBe(1)
    })

    it('should return 200 when status is ACTIVE', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'ACTIVE',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(200)
    })

    it('should return 404 when session status is FINISHED', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'FINISHED',
        currentQuestionIndex: 5,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(404)
    })

    it('should return 404 when session status is QUESTION', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'QUESTION',
        currentQuestionIndex: 2,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: Date.now(),
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(404)
    })

    it('should return 404 when session status is REVEAL', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'REVEAL',
        currentQuestionIndex: 2,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(404)
    })

    it('should return 404 when session status is LEADERBOARD', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LEADERBOARD',
        currentQuestionIndex: 2,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(404)
    })

    it('should not expose internal fields in response', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'super-secret-socket',
        questionStartedAt: 99999,
        hostDisconnectedAt: 12345,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(200)
      expect(res.body.hostSocketId).toBeUndefined()
      expect(res.body.hostDisconnectedAt).toBeUndefined()
      expect(res.body.authorId).toBeUndefined()
      expect(res.body.questionStartedAt).toBeUndefined()
    })

    it('should return participantCount instead of participants object', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {
          'p-1': { id: 'p-1', nickname: 'Maria', avatarId: '2', score: 0, socketId: 's1', isConnected: true },
          'p-2': { id: 'p-2', nickname: 'José', avatarId: '3', score: 0, socketId: 's2', isConnected: true },
        },
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app).get('/api/game-sessions/482971')

      expect(res.status).toBe(200)
      expect(res.body.participantCount).toBe(2)
      expect(res.body.participants).toBeUndefined()
    })

    it('should return 404 when PIN does not exist', async () => {
      mockGameService.getSessionByPin.mockResolvedValueOnce(null)

      const res = await request(app).get('/api/game-sessions/000000')

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/game-sessions/:id', () => {
    it('should return 204 and finalize the session when authenticated and owner', async () => {
      mockGameService.getSessionById.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'user-teacher-001',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })
      mockGameService.finalizeSession.mockResolvedValueOnce(undefined)

      const res = await request(app)
        .delete('/api/game-sessions/session-abc')
        .set('Authorization', 'Bearer token')

      expect(res.status).toBe(204)
      expect(mockGameService.finalizeSession).toHaveBeenCalledOnce()
    })

    it('should return 404 when session does not exist by ID', async () => {
      mockGameService.getSessionById.mockResolvedValueOnce(null)

      const res = await request(app)
        .delete('/api/game-sessions/nonexistent-id')
        .set('Authorization', 'Bearer token')

      expect(res.status).toBe(404)
    })

    it('should return 403 when authenticated user is not the session owner', async () => {
      mockGameService.getSessionById.mockResolvedValueOnce({
        sessionId: 'session-abc',
        pin: '482971',
        status: 'LOBBY',
        currentQuestionIndex: 0,
        quizId: 'quiz-abc',
        participants: {},
        authorId: 'another-user-999',
        hostSocketId: 'socket-1',
        questionStartedAt: null,
        hostDisconnectedAt: null,
      })

      const res = await request(app)
        .delete('/api/game-sessions/session-abc')
        .set('Authorization', 'Bearer token')

      expect(res.status).toBe(403)
      expect(mockGameService.finalizeSession).not.toHaveBeenCalled()
    })

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockImplementationOnce((_req, _res, next) => {
        next(new UnauthorizedError())
      })

      const res = await request(app).delete('/api/game-sessions/session-abc')

      expect(res.status).toBe(401)
      expect(mockGameService.finalizeSession).not.toHaveBeenCalled()
    })
  })
})
