import { PrismaClient } from '@prisma/client'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { seed, SEED_IDS } from '../seed.js'

const prisma = new PrismaClient()

beforeAll(async () => {
  await seed(prisma)
})

afterAll(async () => {
  await prisma.answerOption.deleteMany()
  await prisma.question.deleteMany()
  await prisma.quiz.deleteMany()
  await prisma.user.deleteMany()
  await prisma.$disconnect()
})

describe('seed', () => {
  describe('when seed runs', () => {
    it('should create a teacher with role TEACHER', async () => {
      const teacher = await prisma.user.findUnique({ where: { id: SEED_IDS.teacher } })

      expect(teacher).not.toBeNull()
      expect(teacher?.role).toBe('TEACHER')
      expect(teacher?.email).toBe('prof@azimute.edu')
    })

    it('should create a published quiz linked to the teacher', async () => {
      const quiz = await prisma.quiz.findUnique({
        where: { id: SEED_IDS.quiz },
        include: { author: true },
      })

      expect(quiz).not.toBeNull()
      expect(quiz?.isPublished).toBe(true)
      expect(quiz?.authorId).toBe(SEED_IDS.teacher)
    })

    it('should create questions with exactly 4 options each and 1 correct per question', async () => {
      for (const questionId of [SEED_IDS.q1, SEED_IDS.q2]) {
        const options = await prisma.answerOption.findMany({ where: { questionId } })
        const correctOptions = options.filter((o) => o.isCorrect)

        expect(options).toHaveLength(4)
        expect(correctOptions).toHaveLength(1)
      }
    })

    it('should return questions ordered by the order field', async () => {
      const questions = await prisma.question.findMany({
        where: { quizId: SEED_IDS.quiz },
        orderBy: { order: 'asc' },
      })

      expect(questions).toHaveLength(2)
      expect(questions[0].order).toBe(1)
      expect(questions[1].order).toBe(2)
    })
  })

  describe('when seed runs twice', () => {
    it('should be idempotent and not duplicate records', async () => {
      await seed(prisma)

      const userCount = await prisma.user.count({ where: { id: SEED_IDS.teacher } })
      const quizCount = await prisma.quiz.count({ where: { id: SEED_IDS.quiz } })
      const optionCount = await prisma.answerOption.count({
        where: { questionId: { in: [SEED_IDS.q1, SEED_IDS.q2] } },
      })

      expect(userCount).toBe(1)
      expect(quizCount).toBe(1)
      expect(optionCount).toBe(8)
    })
  })

  describe('when inserting duplicate nickname in the same session', () => {
    it('should reject with unique constraint violation (P2002)', async () => {
      const session = await prisma.gameSession.create({
        data: {
          quizId: SEED_IDS.quiz,
          pin: '999001',
          status: 'LOBBY',
        },
      })

      try {
        await prisma.gameParticipant.create({
          data: { sessionId: session.id, nickname: 'Aluno Teste', avatarId: 'avatar-1' },
        })

        await expect(
          prisma.gameParticipant.create({
            data: { sessionId: session.id, nickname: 'Aluno Teste', avatarId: 'avatar-2' },
          }),
        ).rejects.toMatchObject({ code: 'P2002' })
      } finally {
        await prisma.gameParticipant.deleteMany({ where: { sessionId: session.id } })
        await prisma.gameSession.delete({ where: { id: session.id } })
      }
    })
  })

  describe('when a question is deleted', () => {
    it('should cascade delete its answer options', async () => {
      const question = await prisma.question.create({
        data: {
          quizId: SEED_IDS.quiz,
          text: 'Questão temporária para teste de cascade',
          order: 99,
          options: {
            create: [
              { text: 'Opção A', isCorrect: true, color: 'RED', order: 1 },
              { text: 'Opção B', isCorrect: false, color: 'BLUE', order: 2 },
            ],
          },
        },
      })

      const optionsBefore = await prisma.answerOption.count({ where: { questionId: question.id } })
      expect(optionsBefore).toBe(2)

      await prisma.question.delete({ where: { id: question.id } })

      const optionsAfter = await prisma.answerOption.count({ where: { questionId: question.id } })
      expect(optionsAfter).toBe(0)
    })
  })
})
