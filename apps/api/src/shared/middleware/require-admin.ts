import { ForbiddenError } from '../errors/http-errors.js'
import type { Request, Response, NextFunction } from 'express'
import '../../features/user/user.types.js'

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    next(new ForbiddenError('Acesso restrito a administradores'))
    return
  }
  next()
}
