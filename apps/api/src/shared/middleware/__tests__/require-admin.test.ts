import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedUser } from '../../../features/user/user.types.js'

function makeReq(user?: AuthenticatedUser): Request {
  return { user } as unknown as Request
}

function makeRes(): Response {
  return {} as Response
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

describe('requireAdmin middleware', () => {
  it('should call next without error when user is ADMIN', async () => {
    const { requireAdmin } = await import('../require-admin.js')
    const req = makeReq({ id: 'admin-001', name: 'Admin', email: 'admin@escola.edu.br', role: 'ADMIN' })
    const next = makeNext()

    requireAdmin(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith()
  })

  it('should call next with 403 error when user is TEACHER', async () => {
    const { requireAdmin } = await import('../require-admin.js')
    const req = makeReq({ id: 'teacher-001', name: 'Prof Ana', email: 'ana@escola.edu.br', role: 'TEACHER' })
    const next = makeNext()

    requireAdmin(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }))
  })

  it('should call next with 403 error when req.user is undefined', async () => {
    const { requireAdmin } = await import('../require-admin.js')
    const req = makeReq(undefined)
    const next = makeNext()

    requireAdmin(req, makeRes(), next)

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }))
  })
})
