import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Question, AnswerOption } from '@prisma/client'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../../user/user.types.js'

// ── factories ──────────────────────────────────────────────────────────────

const createQuestionRecord = (overrides?: Partial<Question>): Question => ({
  id: 'question-001',
  quizId: 'quiz-001',
  text: 'Qual é a capital do Brasil?',
  mediaType: null,
  mediaUrl: null,
  timeLimitSecs: 30,
  points: 1000,
  order: 1,
  ...overrides,
})

const teacherUser: AuthenticatedUser = {
  id: 'user-teacher-001',
  name: 'Ana Professora',
  email: 'ana@escola.edu.br',
  role: 'TEACHER',
}

const anotherTeacher: AuthenticatedUser = {
  id: 'user-teacher-002',
  name: 'Bruno Professor',
  email: 'bruno@escola.edu.br',
  role: 'TEACHER',
}

// ── mocks ──────────────────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn())

vi.mock('../../../shared/middleware/require-auth.js', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('../../../config/database.js', () => ({
  prisma: {
    quiz: {
      findUnique: vi.fn(),
    },
    question: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: { ping: vi.fn() },
}))

// ── helpers ────────────────────────────────────────────────────────────────

function asTeacher(user = teacherUser) {
  mockRequireAuth.mockImplementationOnce(
    (req: { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = user
      next()
    },
  )
}

function noAuth() {
  mockRequireAuth.mockImplementationOnce(
    (_req: unknown, _res: unknown, next: (err: Error) => void) => {
      next(new UnauthorizedError('Token não fornecido'))
    },
  )
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('Question Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── POST /api/quizzes/:quizId/questions ────────────────────────────────

  describe('POST /api/quizzes/:quizId/questions', () => {
    it('should return 201 with QuestionPublic when TEACHER creates a question in own quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce({
        id: 'quiz-001',
        authorId: 'user-teacher-001',
      } as never)
      vi.mocked(prisma.question.aggregate).mockResolvedValueOnce({ _max: { order: null } } as never)
      vi.mocked(prisma.question.create).mockResolvedValueOnce(
        createQuestionRecord() as unknown as Question & { options: AnswerOption[] },
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?' })

      expect(response.status).toBe(201)
      expect(response.body.quizId).toBe('quiz-001')
      expect(response.body.order).toBe(1)
    })

    it('should return 401 when no token is provided', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?' })

      expect(response.status).toBe(401)
    })

    it('should return 403 when TEACHER tries to add question to another teacher quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce({
        id: 'quiz-002',
        authorId: 'user-teacher-002',
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-002/questions')
        .send({ text: 'Qual é a capital do Brasil?' })

      expect(response.status).toBe(403)
    })

    it('should return 404 when quiz does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/nonexistent-quiz/questions')
        .send({ text: 'Qual é a capital do Brasil?' })

      expect(response.status).toBe(404)
    })

    it('should return 201 when timeLimitSecs is 5 (boundary min)', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce({
        id: 'quiz-001',
        authorId: 'user-teacher-001',
      } as never)
      vi.mocked(prisma.question.aggregate).mockResolvedValueOnce({ _max: { order: 2 } } as never)
      vi.mocked(prisma.question.create).mockResolvedValueOnce(
        createQuestionRecord({ timeLimitSecs: 5, order: 3 }) as unknown as Question & {
          options: AnswerOption[]
        },
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?', timeLimitSecs: 5 })

      expect(response.status).toBe(201)
    })

    it('should return 400 when timeLimitSecs is 4', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?', timeLimitSecs: 4 })

      expect(response.status).toBe(400)
    })

    it('should return 201 when timeLimitSecs is 120 (boundary max)', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce({
        id: 'quiz-001',
        authorId: 'user-teacher-001',
      } as never)
      vi.mocked(prisma.question.aggregate).mockResolvedValueOnce({ _max: { order: null } } as never)
      vi.mocked(prisma.question.create).mockResolvedValueOnce(
        createQuestionRecord({ timeLimitSecs: 120 }) as unknown as Question & {
          options: AnswerOption[]
        },
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?', timeLimitSecs: 120 })

      expect(response.status).toBe(201)
    })

    it('should return 400 when timeLimitSecs is 121', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?', timeLimitSecs: 121 })

      expect(response.status).toBe(400)
    })

    it('should return 400 when mediaUrl is provided without mediaType', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/quizzes/quiz-001/questions')
        .send({ text: 'Qual é a capital do Brasil?', mediaUrl: 'https://example.com/img.jpg' })

      expect(response.status).toBe(400)
    })
  })

  // ── PATCH /api/questions/:id ───────────────────────────────────────────

  describe('PATCH /api/questions/:id', () => {
    it('should return 200 with updated QuestionPublic when TEACHER updates own question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        ...createQuestionRecord(),
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.question.update).mockResolvedValueOnce(
        createQuestionRecord({ text: 'Qual é a capital do Japão?' }) as unknown as Question & {
          options: AnswerOption[]
        },
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/questions/question-001')
        .send({ text: 'Qual é a capital do Japão?' })

      expect(response.status).toBe(200)
      expect(response.body.text).toBe('Qual é a capital do Japão?')
    })

    it('should return 400 when body is empty', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).patch('/api/questions/question-001').send({})

      expect(response.status).toBe(400)
    })

    it('should return 404 when question does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/questions/nonexistent-question')
        .send({ text: 'Nova pergunta' })

      expect(response.status).toBe(404)
    })

    it('should return 403 when TEACHER tries to update another teacher question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        ...createQuestionRecord(),
        quiz: { authorId: 'user-teacher-002' },
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/questions/question-001')
        .send({ text: 'Nova pergunta' })

      expect(response.status).toBe(403)
    })
  })

  // ── DELETE /api/questions/:id ──────────────────────────────────────────

  describe('DELETE /api/questions/:id', () => {
    it('should return 204 when TEACHER deletes own question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        ...createQuestionRecord(),
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.question.delete).mockResolvedValueOnce(createQuestionRecord() as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/questions/question-001')

      expect(response.status).toBe(204)
    })

    it('should return 403 when TEACHER tries to delete another teacher question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        ...createQuestionRecord(),
        quiz: { authorId: anotherTeacher.id },
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/questions/question-001')

      expect(response.status).toBe(403)
    })

    it('should return 404 when question does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/questions/nonexistent-question')

      expect(response.status).toBe(404)
    })
  })

  // ── PATCH /api/questions/:id/reorder ──────────────────────────────────

  describe('PATCH /api/questions/:id/reorder', () => {
    it('should return 200 with updated order when TEACHER reorders own question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        ...createQuestionRecord(),
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.question.update).mockResolvedValueOnce(
        createQuestionRecord({ order: 2 }) as unknown as Question & { options: AnswerOption[] },
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/questions/question-001/reorder')
        .send({ order: 2 })

      expect(response.status).toBe(200)
      expect(response.body.order).toBe(2)
    })

    it('should return 401 when no token is provided', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/questions/question-001/reorder')
        .send({ order: 2 })

      expect(response.status).toBe(401)
    })
  })
})
