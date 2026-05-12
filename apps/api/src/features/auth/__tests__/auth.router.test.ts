import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import type { User } from '@prisma/client'

const createUserRecord = (overrides?: Partial<User>): User => ({
  id: 'clxxx',
  name: 'Ana Professora',
  email: 'ana@escola.edu.br',
  passwordHash: 'hashed_password',
  role: 'TEACHER',
  isActive: true,
  createdAt: new Date('2026-05-12T00:00:00.000Z'),
  updatedAt: new Date('2026-05-12T00:00:00.000Z'),
  ...overrides,
})

vi.mock('../../../config/database.js', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
    argon2id: 2,
  },
}))

vi.mock('../../../config/redis.js', () => ({
  redis: { ping: vi.fn() },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
  },
}))

describe('Auth Router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /auth/register', () => {
    it('should return 201 with user data when registering first admin', async () => {
      const { prisma } = await import('../../../config/database.js')
      const argon2 = await import('argon2')
      vi.mocked(prisma.user.count).mockResolvedValueOnce(0)
      vi.mocked(argon2.default.hash).mockResolvedValueOnce('hashed_password')
      vi.mocked(prisma.user.create).mockResolvedValueOnce(
        {
          id: 'clxxx',
          name: 'Ana Professora',
          email: 'ana@escola.edu.br',
          role: 'ADMIN',
          createdAt: new Date('2026-05-12T00:00:00.000Z'),
        } as unknown as User,
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/register').send({
        name: 'Ana Professora',
        email: 'ana@escola.edu.br',
        password: 'senha123',
      })

      expect(response.status).toBe(201)
      expect(response.body.id).toBe('clxxx')
      expect(response.body.email).toBe('ana@escola.edu.br')
      expect(response.body.role).toBe('ADMIN')
      expect(response.body.passwordHash).toBeUndefined()
    })

    it('should return 409 when a user already exists', async () => {
      const { prisma } = await import('../../../config/database.js')
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/register').send({
        name: 'Outro Professor',
        email: 'outro@escola.edu.br',
        password: 'senha456',
      })

      expect(response.status).toBe(409)
      expect(response.body.error).toBe(
        'Registro disponível apenas para o primeiro administrador',
      )
    })

    it('should return 400 when email is malformed', async () => {
      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/register').send({
        name: 'Professor Teste',
        email: 'email-invalido',
        password: 'senha123',
      })

      expect(response.status).toBe(400)
    })

    it('should return 400 when password has fewer than 8 characters', async () => {
      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/register').send({
        name: 'Professor Teste',
        email: 'prof@escola.edu.br',
        password: 'curta',
      })

      expect(response.status).toBe(400)
    })
  })

  describe('POST /auth/login', () => {
    it('should return 200 with token and user when credentials are valid', async () => {
      const { prisma } = await import('../../../config/database.js')
      const argon2 = await import('argon2')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())
      vi.mocked(argon2.default.verify).mockResolvedValueOnce(true)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/login').send({
        email: 'ana@escola.edu.br',
        password: 'senha123',
      })

      expect(response.status).toBe(200)
      expect(response.body.token).toBeDefined()
      expect(response.body.user.id).toBe('clxxx')
      expect(response.body.user.email).toBe('ana@escola.edu.br')
      expect(response.body.user.role).toBe('TEACHER')
      expect(response.body.user.passwordHash).toBeUndefined()
    })

    it('should return 401 when user account is deactivated', async () => {
      const { prisma } = await import('../../../config/database.js')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        createUserRecord({ isActive: false }),
      )

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/login').send({
        email: 'ana@escola.edu.br',
        password: 'senha123',
      })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Conta desativada')
    })

    it('should return 401 when email is not found', async () => {
      const { prisma } = await import('../../../config/database.js')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/login').send({
        email: 'naoexiste@escola.edu.br',
        password: 'qualquercoisa',
      })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Credenciais inválidas')
    })

    it('should return 401 when password is incorrect', async () => {
      const { prisma } = await import('../../../config/database.js')
      const argon2 = await import('argon2')
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createUserRecord())
      vi.mocked(argon2.default.verify).mockResolvedValueOnce(false)

      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/login').send({
        email: 'ana@escola.edu.br',
        password: 'senha_errada',
      })

      expect(response.status).toBe(401)
      expect(response.body.error).toBe('Credenciais inválidas')
    })

    it('should return 400 with generic message when body is invalid', async () => {
      const { createApp } = await import('../../../app.js')
      const app = createApp()
      const response = await request(app).post('/auth/login').send({
        email: 'nao-e-email',
      })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Dados de entrada inválidos')
    })
  })
})
