import argon2 from 'argon2'
import { prisma } from '../../config/database.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/http-errors.js'
import type { AuthenticatedUser } from './user.types.js'
import type { CreateUserBody, UpdateUserBody } from './user.schemas.js'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65536,
} as const

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const

export async function createUser(body: CreateUserBody) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) throw new ConflictError('Email já cadastrado')

  const passwordHash = await argon2.hash(body.password, ARGON2_OPTIONS)
  return prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash, role: 'TEACHER' },
    select: USER_SELECT,
  })
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT })
  if (!user) throw new NotFoundError('Usuário não encontrado')
  return user
}

export async function updateUser(
  targetId: string,
  body: UpdateUserBody,
  requester: AuthenticatedUser,
) {
  if (requester.role !== 'ADMIN' && requester.id !== targetId) {
    throw new ForbiddenError('Sem permissão para atualizar este usuário')
  }

  const existing = await prisma.user.findUnique({ where: { id: targetId } })
  if (!existing) throw new NotFoundError('Usuário não encontrado')

  const { password, ...profileFields } = body

  if (profileFields.email && profileFields.email !== existing.email) {
    const emailInUse = await prisma.user.findUnique({ where: { email: profileFields.email } })
    if (emailInUse) throw new ConflictError('Email já cadastrado')
  }

  const updateData: { name?: string; email?: string; passwordHash?: string } = { ...profileFields }
  if (password) {
    updateData.passwordHash = await argon2.hash(password, ARGON2_OPTIONS)
  }

  return prisma.user.update({
    where: { id: targetId },
    data: updateData,
    select: USER_SELECT,
  })
}

export async function deleteUser(targetId: string) {
  const existing = await prisma.user.findUnique({ where: { id: targetId } })
  if (!existing) throw new NotFoundError('Usuário não encontrado')

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: false },
  })
}
