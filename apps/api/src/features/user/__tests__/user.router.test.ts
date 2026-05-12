import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { User } from '@prisma/client'
import { UnauthorizedError } from '../../../shared/errors/http-errors.js'
import type { AuthenticatedUser, UserPublic } from '../user.types.js'

// ── factories ──────────────────────────────────────────────────────────────

// Full DB record (used for findUnique mocks in service/middleware)
const createUserRecord = (overrides?: Partial<User>): User => ({
  id: 'user-teacher-001',
  name: 'Ana Professora',
  email: 'ana@escola.edu.br',
  passwordHash: 'hashed_password',
  role: 'TEACHER',
  isActive: true,
  createdAt: new Date('2026-05-12T00:00:00.000Z'),
  updatedAt: new Date('2026-05-12T00:00:00.000Z'),
  ...overrides,
})

// Public representation returned by create/update with select (no passwordHash)
const createUserPublic = (overrides?: Partial<UserPublic>): UserPublic => ({
  id: 'user-teacher-001',
  name: 'Ana Professora',
  email: 'ana@escola.edu.br',
  role: 'TEACHER',
  isActive: true,
  createdAt: new Date('2026-05-12T00:00:00.000Z'),
  ...overrides,
})

const adminUser: AuthenticatedUser = {
  id: 'user-admin-001',
  name: 'Carlos Admin',
  email: 'carlos.admin@escola.edu.br',
  role: 'ADMIN',
}

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
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    argon2id: 2,
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: { ping: vi.fn() },
}))

// ── helpers ────────────────────────────────────────────────────────────────

function asAdmin() {
  mockRequireAuth.mockImplementationOnce(
    (req: { user?: AuthenticatedUser }, _res: unknown, next: () => void) => {
      req.user = adminUser
      next()
    },
  )
}

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

function expiredAuth() {
  mockRequireAuth.mockImplementationOnce(
    (_req: unknown, _res: unknown, next: (err: Error) => void) => {
      next(new UnauthorizedError('Token expirado'))
    },
  )
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('User Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── POST /api/users ───────────────────────────────────────────────────────

  describe('POST /api/users', () => {
    it('should return 201 with UserPublic when ADMIN creates a teacher', async () => {
      const { prisma } = await import('../../../config/database.js')
      const argon2 = await import('argon2')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(argon2.default.hash).mockResolvedValueOnce('hashed_nova_senha')
      vi.mocked(prisma.user.create).mockResolvedValueOnce(
        createUserPublic({ id: 'user-teacher-new', email: 'novo@escola.edu.br', name: 'Novo Professor' }) as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/api/users').send({
        name: 'Novo Professor',
        email: 'novo@escola.edu.br',
        password: 'senha12345',
      })

      expect(response.status).toBe(201)
      expect(response.body.email).toBe('novo@escola.edu.br')
      expect(response.body.passwordHash).toBeUndefined()
    })

    it('should return 403 when TEACHER tries to create a user', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/api/users').send({
        name: 'Novo Professor',
        email: 'novo@escola.edu.br',
        password: 'senha12345',
      })

      expect(response.status).toBe(403)
    })

    it('should return 409 when email is already in use', async () => {
      const { prisma } = await import('../../../config/database.js')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/api/users').send({
        name: 'Ana Duplicada',
        email: 'ana@escola.edu.br',
        password: 'senha12345',
      })

      expect(response.status).toBe(409)
    })

    it('should return 400 when body is invalid (missing email)', async () => {
      asAdmin()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/api/users').send({
        name: 'Sem Email',
        password: 'senha12345',
      })

      expect(response.status).toBe(400)
    })

    it('should return 401 when no token is provided', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/api/users').send({
        name: 'Professor',
        email: 'prof@escola.edu.br',
        password: 'senha12345',
      })

      expect(response.status).toBe(401)
    })
  })

  // ── GET /api/users/me ─────────────────────────────────────────────────────

  describe('GET /api/users/me', () => {
    it('should return 200 with own profile when token is valid', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        createUserPublic() as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).get('/api/users/me')

      expect(response.status).toBe(200)
      expect(response.body.id).toBe('user-teacher-001')
      expect(response.body.passwordHash).toBeUndefined()
    })

    it('should return 401 when token is expired', async () => {
      expiredAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).get('/api/users/me')

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Token expirado')
    })

    it('should return 401 when no token is provided', async () => {
      noAuth()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).get('/api/users/me')

      expect(response.status).toBe(401)
    })
  })

  // ── PATCH /api/users/:id ──────────────────────────────────────────────────

  describe('PATCH /api/users/:id', () => {
    it('should return 200 when TEACHER updates own profile', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())
      vi.mocked(prisma.user.update).mockResolvedValueOnce(
        createUserPublic({ name: 'Ana Atualizada' }) as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/users/user-teacher-001')
        .send({ name: 'Ana Atualizada' })

      expect(response.status).toBe(200)
      expect(response.body.name).toBe('Ana Atualizada')
    })

    it('should return 403 when TEACHER tries to update another user', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/users/user-teacher-002')
        .send({ name: 'Tentativa' })

      expect(response.status).toBe(403)
    })

    it('should return 200 when ADMIN updates any user', async () => {
      const { prisma } = await import('../../../config/database.js')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())
      vi.mocked(prisma.user.update).mockResolvedValueOnce(
        createUserPublic({ name: 'Ana Editada pelo Admin' }) as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/users/user-teacher-001')
        .send({ name: 'Ana Editada pelo Admin' })

      expect(response.status).toBe(200)
    })

    it('should return 409 when new email is already in use', async () => {
      const { prisma } = await import('../../../config/database.js')
      asTeacher()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord()) // target user
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        createUserRecord({ id: 'user-other', email: 'ocupado@escola.edu.br' }), // email already used
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/users/user-teacher-001')
        .send({ email: 'ocupado@escola.edu.br' })

      expect(response.status).toBe(409)
    })

    it('should return 404 when user is not found', async () => {
      const { prisma } = await import('../../../config/database.js')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app)
        .patch('/api/users/nonexistent-id')
        .send({ name: 'Alguém' })

      expect(response.status).toBe(404)
    })

    it('should return 400 when body is empty', async () => {
      asTeacher()

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).patch('/api/users/user-teacher-001').send({})

      expect(response.status).toBe(400)
    })
  })

  // ── DELETE /api/users/:id ─────────────────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('should return 204 when ADMIN soft-deletes a user', async () => {
      const { prisma } = await import('../../../config/database.js')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())
      vi.mocked(prisma.user.update).mockResolvedValueOnce(
        createUserPublic({ isActive: false }) as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/users/user-teacher-001')

      expect(response.status).toBe(204)
    })

    it('should return 403 when TEACHER tries to delete a user', async () => {
      asTeacher(anotherTeacher)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/users/user-teacher-001')

      expect(response.status).toBe(403)
    })

    it('should return 404 when user to delete is not found', async () => {
      const { prisma } = await import('../../../config/database.js')
      asAdmin()
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).delete('/api/users/nonexistent-id')

      expect(response.status).toBe(404)
    })
  })
})
