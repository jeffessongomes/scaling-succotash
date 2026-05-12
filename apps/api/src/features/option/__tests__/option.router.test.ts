import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { AnswerOption } from '@prisma/client'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from '../../user/user.types.js'

// ── factories ──────────────────────────────────────────────────────────────

const createOptionRecord = (overrides?: Partial<AnswerOption>): AnswerOption => ({
  id: 'option-001',
  questionId: 'question-001',
  text: 'Brasília',
  isCorrect: false,
  color: 'RED',
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
    question: {
      findUnique: vi.fn(),
    },
    answerOption: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

describe('Option Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── POST /api/questions/:questionId/options ────────────────────────────

  describe('POST /api/questions/:questionId/options', () => {
    it('should return 201 with AnswerOptionPublic when question has fewer than 4 options', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        id: 'question-001',
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.answerOption.count).mockResolvedValueOnce(2)
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        if (typeof fn === 'function') return fn(prisma)
        return fn
      })
      vi.mocked(prisma.answerOption.create).mockResolvedValueOnce(createOptionRecord())

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'Brasília', isCorrect: false, color: 'RED' })

      expect(response.status).toBe(201)
      expect(response.body.questionId).toBe('question-001')
    })

    it('should return 422 when question already has 4 options', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        id: 'question-001',
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.answerOption.count).mockResolvedValueOnce(4)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'São Paulo', isCorrect: false, color: 'BLUE' })

      expect(response.status).toBe(422)
      expect(response.body.error).toMatch(/4 opções/)
    })

    it('should return 201 and reset other options when isCorrect is true', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        id: 'question-001',
        quiz: { authorId: 'user-teacher-001' },
      } as never)
      vi.mocked(prisma.answerOption.count).mockResolvedValueOnce(1)
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        if (typeof fn === 'function') return fn(prisma)
        return fn
      })
      vi.mocked(prisma.answerOption.updateMany).mockResolvedValueOnce({ count: 1 })
      vi.mocked(prisma.answerOption.create).mockResolvedValueOnce(
        createOptionRecord({ isCorrect: true }),
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'Brasília', isCorrect: true, color: 'GREEN' })

      expect(response.status).toBe(201)
      expect(response.body.isCorrect).toBe(true)
    })

    it('should return 401 when no token is provided', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'Brasília', isCorrect: false, color: 'RED' })

      expect(response.status).toBe(401)
    })

    it('should return 403 when TEACHER tries to add option to another teacher question', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce({
        id: 'question-001',
        quiz: { authorId: anotherTeacher.id },
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'Brasília', isCorrect: false, color: 'RED' })

      expect(response.status).toBe(403)
    })

    it('should return 400 when color is invalid', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/question-001/options')
        .send({ text: 'Brasília', isCorrect: false, color: 'PURPLE' })

      expect(response.status).toBe(400)
    })

    it('should return 404 when question does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.question.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .post('/api/questions/nonexistent-question/options')
        .send({ text: 'Brasília', isCorrect: false, color: 'RED' })

      expect(response.status).toBe(404)
    })
  })

  // ── PATCH /api/options/:id ─────────────────────────────────────────────

  describe('PATCH /api/options/:id', () => {
    it('should return 200 and reset other options when isCorrect is set to true', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce({
        ...createOptionRecord(),
        question: { quiz: { authorId: 'user-teacher-001' } },
      } as never)
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        if (typeof fn === 'function') return fn(prisma)
        return fn
      })
      vi.mocked(prisma.answerOption.updateMany).mockResolvedValueOnce({ count: 2 })
      vi.mocked(prisma.answerOption.update).mockResolvedValueOnce(
        createOptionRecord({ isCorrect: true }),
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/options/option-001')
        .send({ isCorrect: true })

      expect(response.status).toBe(200)
      expect(response.body.isCorrect).toBe(true)
    })

    it('should return 400 when body is empty', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).patch('/api/options/option-001').send({})

      expect(response.status).toBe(400)
    })

    it('should return 404 when option does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/options/nonexistent-option')
        .send({ text: 'Nova resposta' })

      expect(response.status).toBe(404)
    })

    it('should return 403 when TEACHER tries to update another teacher option', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce({
        ...createOptionRecord(),
        question: { quiz: { authorId: anotherTeacher.id } },
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/options/option-001')
        .send({ text: 'Nova resposta' })

      expect(response.status).toBe(403)
    })
  })

  // ── DELETE /api/options/:id ────────────────────────────────────────────

  describe('DELETE /api/options/:id', () => {
    it('should return 204 when TEACHER deletes own option', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce({
        ...createOptionRecord(),
        question: { quiz: { authorId: 'user-teacher-001' } },
      } as never)
      vi.mocked(prisma.answerOption.delete).mockResolvedValueOnce(createOptionRecord())

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/options/option-001')

      expect(response.status).toBe(204)
    })

    it('should return 403 when TEACHER tries to delete another teacher option', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce({
        ...createOptionRecord(),
        question: { quiz: { authorId: anotherTeacher.id } },
      } as never)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/options/option-001')

      expect(response.status).toBe(403)
    })

    it('should return 404 when option does not exist', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.answerOption.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/options/nonexistent-option')

      expect(response.status).toBe(404)
    })
  })
})
