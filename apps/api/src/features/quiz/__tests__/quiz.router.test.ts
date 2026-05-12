import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { Quiz } from '@prisma/client'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../../user/user.types.js'
import type { QuizSummary, QuizDetail } from '../quiz.schemas.js'

// ── factories ──────────────────────────────────────────────────────────────

const createQuizRecord = (overrides?: Partial<Quiz>): Quiz => ({
  id: 'quiz-001',
  title: 'Quiz de Geografia',
  description: 'Perguntas sobre capitais do mundo',
  coverImage: null,
  isPublished: false,
  authorId: 'user-teacher-001',
  createdAt: new Date('2026-01-10T10:00:00Z'),
  updatedAt: new Date('2026-01-10T10:00:00Z'),
  ...overrides,
})

const createQuizSummary = (overrides?: Partial<QuizSummary>): QuizSummary => ({
  id: 'quiz-001',
  title: 'Quiz de Geografia',
  description: 'Perguntas sobre capitais do mundo',
  coverImage: null,
  isPublished: false,
  authorId: 'user-teacher-001',
  _count: { questions: 0 },
  createdAt: new Date('2026-01-10T10:00:00Z'),
  updatedAt: new Date('2026-01-10T10:00:00Z'),
  ...overrides,
})

const createQuizDetail = (overrides?: Partial<QuizDetail>): QuizDetail => ({
  ...createQuizSummary(),
  _count: { questions: 1 },
  questions: [
    {
      id: 'question-001',
      quizId: 'quiz-001',
      text: 'Qual é a capital do Brasil?',
      mediaType: null,
      mediaUrl: null,
      timeLimitSecs: 30,
      points: 100,
      order: 1,
      options: [
        { id: 'option-001', questionId: 'question-001', text: 'Brasília', isCorrect: true, color: 'RED', order: 1 },
        { id: 'option-002', questionId: 'question-001', text: 'São Paulo', isCorrect: false, color: 'BLUE', order: 2 },
      ],
    },
  ],
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

const adminUser: AuthenticatedUser = {
  id: 'user-admin-001',
  name: 'Carlos Admin',
  email: 'carlos@escola.edu.br',
  role: 'ADMIN',
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
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gameSession: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
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

describe('Quiz Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── POST /api/quizzes ──────────────────────────────────────────────────

  describe('POST /api/quizzes', () => {
    it('should return 201 with QuizSummary when TEACHER creates a quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      const summary = createQuizSummary()
      vi.mocked(prisma.quiz.create).mockResolvedValueOnce(createQuizSummary() as unknown as Quiz)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'Quiz de Geografia', description: 'Perguntas sobre capitais do mundo' })

      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({
        id: summary.id,
        title: summary.title,
        authorId: teacherUser.id,
        isPublished: false,
      })
    })

    it('should set authorId to authenticated user id regardless of body', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.create).mockResolvedValueOnce(
        createQuizSummary({ authorId: teacherUser.id }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'Meu Quiz', authorId: 'outro-usuario-id' })

      expect(res.status).toBe(201)
      expect(res.body.authorId).toBe(teacherUser.id)
    })

    it('should return 400 when title is missing', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).post('/api/quizzes').send({ description: 'Sem título' })

      expect(res.status).toBe(400)
    })

    it('should return 400 when title exceeds 200 characters', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'A'.repeat(201) })

      expect(res.status).toBe(400)
    })

    it('should return 400 when coverImage is not a valid URL', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'Quiz válido', coverImage: 'nao-eh-url' })

      expect(res.status).toBe(400)
    })

    it('should return 401 when not authenticated', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .post('/api/quizzes')
        .send({ title: 'Quiz sem auth' })

      expect(res.status).toBe(401)
    })
  })

  // ── GET /api/quizzes ───────────────────────────────────────────────────

  describe('GET /api/quizzes', () => {
    it('should return 200 with only TEACHER own quizzes', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      const quizzes = [createQuizRecord(), createQuizRecord({ id: 'quiz-002', title: 'Quiz 2' })]
      vi.mocked(prisma.quiz.findMany).mockResolvedValueOnce(quizzes as unknown as Quiz[])

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(vi.mocked(prisma.quiz.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { authorId: teacherUser.id },
        }),
      )
    })

    it('should return 200 with all quizzes when ADMIN lists', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher(adminUser)
      const quizzes = [
        createQuizRecord({ authorId: 'user-teacher-001' }),
        createQuizRecord({ id: 'quiz-002', authorId: 'user-teacher-002' }),
      ]
      vi.mocked(prisma.quiz.findMany).mockResolvedValueOnce(quizzes as unknown as Quiz[])

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes')

      expect(res.status).toBe(200)
      expect(vi.mocked(prisma.quiz.findMany)).toHaveBeenCalledWith(
        expect.not.objectContaining({
          where: expect.objectContaining({ authorId: expect.anything() }),
        }),
      )
    })

    it('should return 200 with empty array when TEACHER has no quizzes', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findMany).mockResolvedValueOnce([])

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('should return 401 when not authenticated', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes')

      expect(res.status).toBe(401)
    })
  })

  // ── GET /api/quizzes/:id ───────────────────────────────────────────────

  describe('GET /api/quizzes/:id', () => {
    it('should return 200 with QuizDetail including questions and options', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizDetail() as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes/quiz-001')

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ id: 'quiz-001', title: 'Quiz de Geografia' })
      expect(Array.isArray(res.body.questions)).toBe(true)
      expect(res.body.questions).toHaveLength(1)
      expect(res.body.questions[0]).toMatchObject({ id: 'question-001', text: 'Qual é a capital do Brasil?' })
      expect(Array.isArray(res.body.questions[0].options)).toBe(true)
      expect(res.body.questions[0].options).toHaveLength(2)
    })

    it('should return 404 when quiz does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes/quiz-inexistente')

      expect(res.status).toBe(404)
    })

    it('should return 401 when not authenticated', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).get('/api/quizzes/quiz-001')

      expect(res.status).toBe(401)
    })
  })

  // ── PATCH /api/quizzes/:id ─────────────────────────────────────────────

  describe('PATCH /api/quizzes/:id', () => {
    it('should return 200 with updated quiz when author edits title', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )
      vi.mocked(prisma.quiz.update).mockResolvedValueOnce(
        createQuizSummary({ title: 'Novo Título' }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001')
        .send({ title: 'Novo Título' })

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Novo Título')
    })

    it('should return 403 when TEACHER tries to edit another teacher quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher(anotherTeacher)
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001')
        .send({ title: 'Tentativa' })

      expect(res.status).toBe(403)
    })

    it('should return 200 when ADMIN edits any teacher quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher(adminUser)
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )
      vi.mocked(prisma.quiz.update).mockResolvedValueOnce(
        createQuizSummary({ title: 'Editado por Admin' }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001')
        .send({ title: 'Editado por Admin' })

      expect(res.status).toBe(200)
    })

    it('should return 400 when body is empty', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).patch('/api/quizzes/quiz-001').send({})

      expect(res.status).toBe(400)
    })

    it('should return 404 when quiz does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-inexistente')
        .send({ title: 'Novo' })

      expect(res.status).toBe(404)
    })
  })

  // ── DELETE /api/quizzes/:id ────────────────────────────────────────────

  describe('DELETE /api/quizzes/:id', () => {
    it('should return 204 when author deletes quiz without active sessions', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )
      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{ count: 0 }, createQuizRecord()] as unknown as [unknown, Quiz])

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).delete('/api/quizzes/quiz-001')

      expect(res.status).toBe(204)
    })

    it('should finalize active sessions and return 204 when quiz has active sessions', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )
      vi.mocked(prisma.$transaction).mockResolvedValueOnce([{ count: 1 }, createQuizRecord()] as unknown as [unknown, Quiz])

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).delete('/api/quizzes/quiz-001')

      expect(res.status).toBe(204)
      expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled()
    })

    it('should return 403 when TEACHER tries to delete another teacher quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher(anotherTeacher)
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).delete('/api/quizzes/quiz-001')

      expect(res.status).toBe(403)
    })

    it('should return 404 when quiz does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app).delete('/api/quizzes/quiz-inexistente')

      expect(res.status).toBe(404)
    })
  })

  // ── PATCH /api/quizzes/:id/publish ────────────────────────────────────

  describe('PATCH /api/quizzes/:id/publish', () => {
    it('should return 200 with isPublished true when quiz has valid questions', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique)
        .mockResolvedValueOnce(createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz)
        .mockResolvedValueOnce({
          ...createQuizRecord(),
          questions: [
            { _count: { options: 2 } },
            { _count: { options: 3 } },
          ],
        } as unknown as Quiz)
      vi.mocked(prisma.quiz.update).mockResolvedValueOnce(
        createQuizSummary({ isPublished: true }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({ isPublished: true })

      expect(res.status).toBe(200)
      expect(res.body.isPublished).toBe(true)
    })

    it('should return 422 when quiz has no questions', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique)
        .mockResolvedValueOnce(createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz)
        .mockResolvedValueOnce({
          ...createQuizRecord(),
          questions: [],
        } as unknown as Quiz)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({ isPublished: true })

      expect(res.status).toBe(422)
    })

    it('should return 422 when all questions have fewer than 2 options', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique)
        .mockResolvedValueOnce(createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz)
        .mockResolvedValueOnce({
          ...createQuizRecord(),
          questions: [{ _count: { options: 1 } }],
        } as unknown as Quiz)

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({ isPublished: true })

      expect(res.status).toBe(422)
    })

    it('should return 200 when unpublishing without question validation', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id, isPublished: true }) as unknown as Quiz,
      )
      vi.mocked(prisma.quiz.update).mockResolvedValueOnce(
        createQuizSummary({ isPublished: false }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({ isPublished: false })

      expect(res.status).toBe(200)
      expect(res.body.isPublished).toBe(false)
    })

    it('should return 403 when TEACHER tries to publish another teacher quiz', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher(anotherTeacher)
      vi.mocked(prisma.quiz.findUnique).mockResolvedValueOnce(
        createQuizRecord({ authorId: teacherUser.id }) as unknown as Quiz,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({ isPublished: true })

      expect(res.status).toBe(403)
    })

    it('should return 400 when body does not contain isPublished', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()

      const res = await request(app)
        .patch('/api/quizzes/quiz-001/publish')
        .send({})

      expect(res.status).toBe(400)
    })
  })
})
