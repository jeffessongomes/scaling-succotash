import jwt from 'jsonwebtoken'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { UnauthorizedError } from '../errors/http-errors.js'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedUser } from '../../features/user/user.types.js'

interface JwtPayload {
  sub: string
  role: 'TEACHER' | 'ADMIN'
  iat: number
  exp: number
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token não fornecido')
    }

    const token = authHeader.substring(7)

    let payload: JwtPayload
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expirado')
      }
      throw new UnauthorizedError('Token inválido')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Conta desativada ou usuário não encontrado')
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }
    req.user = authenticatedUser
    next()
  } catch (err) {
    next(err)
  }
}
