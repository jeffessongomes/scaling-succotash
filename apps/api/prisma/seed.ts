import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

export const SEED_IDS = {
  teacher: 'seed-teacher-azimute-2026',
  quiz: 'seed-quiz-capitais-brasil-2026',
  q1: 'seed-q1-capital-brasil-2026',
  q2: 'seed-q2-capital-sp-2026',
  q1Options: {
    brasilia: 'seed-q1-opt-brasilia-2026',
    riodejaneiro: 'seed-q1-opt-rio-2026',
    saopaulo: 'seed-q1-opt-sp-2026',
    salvador: 'seed-q1-opt-salvador-2026',
  },
  q2Options: {
    saopaulo: 'seed-q2-opt-sp-2026',
    campinas: 'seed-q2-opt-campinas-2026',
    santos: 'seed-q2-opt-santos-2026',
    ribeiraopreto: 'seed-q2-opt-rp-2026',
  },
} as const

export async function seed(prisma: PrismaClient) {
  const passwordHash = await argon2.hash(process.env.SEED_TEACHER_PASSWORD ?? 'Professor@2026')

  const teacher = await prisma.user.upsert({
    where: { id: SEED_IDS.teacher },
    update: {},
    create: {
      id: SEED_IDS.teacher,
      name: 'Prof. Maria Silva',
      email: 'prof@azimute.edu',
      passwordHash,
      role: 'TEACHER',
    },
  })

  const quiz = await prisma.quiz.upsert({
    where: { id: SEED_IDS.quiz },
    update: {},
    create: {
      id: SEED_IDS.quiz,
      title: 'Capitais do Brasil',
      description: 'Quiz sobre as capitais dos estados brasileiros',
      isPublished: true,
      authorId: teacher.id,
    },
  })

  const q1 = await prisma.question.upsert({
    where: { id: SEED_IDS.q1 },
    update: {},
    create: {
      id: SEED_IDS.q1,
      quizId: quiz.id,
      text: 'Qual é a capital do Brasil?',
      timeLimitSecs: 30,
      points: 1000,
      order: 1,
    },
  })

  const q2 = await prisma.question.upsert({
    where: { id: SEED_IDS.q2 },
    update: {},
    create: {
      id: SEED_IDS.q2,
      quizId: quiz.id,
      text: 'Qual é a capital do estado de São Paulo?',
      timeLimitSecs: 30,
      points: 1000,
      order: 2,
    },
  })

  const q1Options = [
    { id: SEED_IDS.q1Options.brasilia, text: 'Brasília', isCorrect: true, color: 'RED' as const, order: 1 },
    { id: SEED_IDS.q1Options.riodejaneiro, text: 'Rio de Janeiro', isCorrect: false, color: 'BLUE' as const, order: 2 },
    { id: SEED_IDS.q1Options.saopaulo, text: 'São Paulo', isCorrect: false, color: 'YELLOW' as const, order: 3 },
    { id: SEED_IDS.q1Options.salvador, text: 'Salvador', isCorrect: false, color: 'GREEN' as const, order: 4 },
  ]

  const q2Options = [
    { id: SEED_IDS.q2Options.saopaulo, text: 'São Paulo', isCorrect: true, color: 'RED' as const, order: 1 },
    { id: SEED_IDS.q2Options.campinas, text: 'Campinas', isCorrect: false, color: 'BLUE' as const, order: 2 },
    { id: SEED_IDS.q2Options.santos, text: 'Santos', isCorrect: false, color: 'YELLOW' as const, order: 3 },
    { id: SEED_IDS.q2Options.ribeiraopreto, text: 'Ribeirão Preto', isCorrect: false, color: 'GREEN' as const, order: 4 },
  ]

  for (const opt of q1Options) {
    await prisma.answerOption.upsert({
      where: { id: opt.id },
      update: {},
      create: { ...opt, questionId: q1.id },
    })
  }

  for (const opt of q2Options) {
    await prisma.answerOption.upsert({
      where: { id: opt.id },
      update: {},
      create: { ...opt, questionId: q2.id },
    })
  }

  return { teacher, quiz, q1, q2 }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const result = await seed(prisma)
    console.log(`✅ Seed concluído:`)
    console.log(`   Professor: ${result.teacher.email}`)
    console.log(`   Quiz: "${result.quiz.title}" (8 opções em 2 questões)`)
  } finally {
    await prisma.$disconnect()
  }
}

// Only run when invoked directly (not when imported as a module)
import { fileURLToPath } from 'url'
const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch(console.error)
}
