import argon2 from 'argon2'
import { prisma } from '../../config/database.js'
import { ConflictError, UnauthorizedError } from '../../shared/errors/http-errors.js'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65536,
} as const

export async function createFirstAdmin(name: string, email: string, password: string) {
  const count = await prisma.user.count()
  if (count > 0) {
    throw new ConflictError('Registro disponível apenas para o primeiro administrador')
  }
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS)
  return prisma.user.create({
    data: { name, email, passwordHash, role: 'ADMIN' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
}

export async function validateCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new UnauthorizedError('Credenciais inválidas')
  const valid = await argon2.verify(user.passwordHash, password)
  if (!valid) throw new UnauthorizedError('Credenciais inválidas')
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}
