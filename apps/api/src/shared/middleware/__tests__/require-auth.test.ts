import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('../../../config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('jsonwebtoken', () => {
  class TokenExpiredError extends Error {
    expiredAt: Date
    constructor(message: string, expiredAt: Date) {
      super(message)
      this.name = 'TokenExpiredError'
      this.expiredAt = expiredAt
    }
  }
  class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'JsonWebTokenError'
    }
  }
  return {
    default: {
      verify: vi.fn(),
      TokenExpiredError,
      JsonWebTokenError,
    },
    TokenExpiredError,
    JsonWebTokenError,
  }
})

const createActiveUser = () => ({
  id: 'user-admin-001',
  name: 'Carlos Admin',
  email: 'carlos.admin@escola.edu.br',
  passwordHash: 'hashed',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: new Date('2026-05-12T00:00:00.000Z'),
  updatedAt: new Date('2026-05-12T00:00:00.000Z'),
})

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request
}

function makeRes(): Response {
  return {} as Response
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should inject req.user and call next when token is valid', async () => {
    const { prisma } = await import('../../../config/database.js')
    const jwt = await import('jsonwebtoken')
    vi.mocked(jwt.default.verify).mockReturnValueOnce(
      { sub: 'user-admin-001', role: 'ADMIN' } as unknown as ReturnType<typeof jwt.default.verify>,
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(createActiveUser())

    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Bearer valid.jwt.token' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
    expect(req.user).toEqual({
      id: 'user-admin-001',
      name: 'Carlos Admin',
      email: 'carlos.admin@escola.edu.br',
      role: 'ADMIN',
    })
  })

  it('should call next with 401 error when Authorization header is missing', async () => {
    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({})
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })

  it('should call next with 401 error when Authorization header has wrong format', async () => {
    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Basic sometoken' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })

  it('should call next with 401 and message "Token expirado" when token is expired', async () => {
    const jwt = await import('jsonwebtoken')
    vi.mocked(jwt.default.verify).mockImplementationOnce(() => {
      throw new jwt.default.TokenExpiredError('jwt expired', new Date())
    })

    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Bearer expired.jwt.token' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Token expirado' }),
    )
  })

  it('should call next with 401 and message "Token inválido" when token is malformed', async () => {
    const jwt = await import('jsonwebtoken')
    vi.mocked(jwt.default.verify).mockImplementationOnce(() => {
      throw new Error('invalid signature')
    })

    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Bearer malformed.token' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Token inválido' }),
    )
  })

  it('should call next with 401 error when user has isActive false', async () => {
    const { prisma } = await import('../../../config/database.js')
    const jwt = await import('jsonwebtoken')
    vi.mocked(jwt.default.verify).mockReturnValueOnce(
      { sub: 'user-inactive-001', role: 'TEACHER' } as unknown as ReturnType<typeof jwt.default.verify>,
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      ...createActiveUser(),
      id: 'user-inactive-001',
      role: 'TEACHER',
      isActive: false,
    })

    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Bearer valid.but.inactive.token' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })

  it('should call next with 401 error when user is not found in database', async () => {
    const { prisma } = await import('../../../config/database.js')
    const jwt = await import('jsonwebtoken')
    vi.mocked(jwt.default.verify).mockReturnValueOnce(
      { sub: 'user-nonexistent', role: 'TEACHER' } as unknown as ReturnType<typeof jwt.default.verify>,
    )
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const { requireAuth } = await import('../require-auth.js')
    const req = makeReq({ authorization: 'Bearer valid.token.user.deleted' })
    const next = makeNext()

    await requireAuth(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }))
  })
})
