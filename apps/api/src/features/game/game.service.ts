import { prisma } from '../../config/database.js'
import { redis } from '../../config/redis.js'
import {
  NotFoundError,
  UnprocessableEntityError,
  ConflictError,
} from '../../shared/errors/http-errors.js'
import {
  saveSession,
  getSession,
  deleteSession,
  getAnswers,
  deleteAnswers,
} from '../../infrastructure/cache/game-state.cache.js'
import { generateUniquePin } from '../../shared/utils/pin-generator.js'
import { calculateScore } from '../../shared/utils/scoring.js'
import type { CreateSessionBody } from './game.schemas.js'
import type { GameSessionState } from './game.types.js'

interface CreateSessionResult {
  sessionId: string
  pin: string
  status: string
  quizTitle: string
  totalQuestions: number
}

export async function createSession(
  body: CreateSessionBody,
  userId: string,
  hostSocketId: string,
): Promise<CreateSessionResult> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: body.quizId },
    select: {
      id: true,
      title: true,
      isPublished: true,
      authorId: true,
      questions: {
        select: {
          id: true,
          text: true,
          timeLimitSecs: true,
          points: true,
          mediaType: true,
          mediaUrl: true,
          order: true,
          options: {
            select: { id: true, text: true, isCorrect: true, color: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!quiz) throw new NotFoundError('Quiz não encontrado')
  if (!quiz.isPublished) throw new UnprocessableEntityError('Quiz não está publicado')
  if (quiz.questions.length === 0) throw new UnprocessableEntityError('O quiz não tem perguntas')

  const existingSession = await prisma.gameSession.findFirst({
    where: { quizId: body.quizId, status: { not: 'FINISHED' } },
  })
  if (existingSession) throw new ConflictError('Já existe uma sessão ativa para este quiz')

  const pin = await generateUniquePin(redis)

  const session = await prisma.gameSession.create({
    data: { quizId: body.quizId, pin, status: 'LOBBY' },
    select: { id: true, pin: true, status: true, quizId: true },
  })

  const sessionState: GameSessionState = {
    sessionId: session.id,
    pin,
    quizId: body.quizId,
    authorId: userId,
    hostSocketId,
    status: 'LOBBY',
    currentQuestionIndex: 0,
    questionStartedAt: null,
    hostDisconnectedAt: null,
    participants: {},
  }

  await saveSession(sessionState)

  return {
    sessionId: session.id,
    pin,
    status: 'LOBBY',
    quizTitle: quiz.title,
    totalQuestions: quiz.questions.length,
  }
}

export async function getSessionByPin(pin: string): Promise<GameSessionState | null> {
  const cached = await getSession(pin)
  if (cached) return cached

  const dbSession = await prisma.gameSession.findUnique({
    where: { pin },
    select: {
      id: true,
      pin: true,
      status: true,
      currentQuestionIndex: true,
      quizId: true,
      participants: {
        select: { id: true, nickname: true, avatarId: true, score: true },
      },
    },
  })

  if (!dbSession) return null

  const participants: GameSessionState['participants'] = {}
  for (const p of dbSession.participants) {
    participants[p.id] = {
      id: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      score: p.score,
      socketId: '',
      isConnected: false,
    }
  }

  return {
    sessionId: dbSession.id,
    pin: dbSession.pin,
    quizId: dbSession.quizId,
    authorId: '',
    hostSocketId: '',
    status: dbSession.status as GameSessionState['status'],
    currentQuestionIndex: dbSession.currentQuestionIndex,
    questionStartedAt: null,
    hostDisconnectedAt: null,
    participants,
  }
}

export async function getSessionById(id: string): Promise<GameSessionState | null> {
  const dbSession = await prisma.gameSession.findUnique({
    where: { id },
    select: { pin: true },
  })
  if (!dbSession) return null
  return getSessionByPin(dbSession.pin)
}

export async function finalizeSession(session: GameSessionState): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: session.quizId },
    select: {
      questions: {
        select: {
          id: true,
          options: { select: { id: true, isCorrect: true } },
          timeLimitSecs: true,
          points: true,
        },
      },
    },
  })

  const now = new Date()
  const answerRecords: Array<{
    sessionId: string
    participantId: string
    questionId: string
    optionId: string
    isCorrect: boolean
    pointsEarned: number
    answeredInMs: number
    answeredAt: Date
  }> = []

  if (quiz) {
    for (const question of quiz.questions) {
      const answers = await getAnswers(session.pin, question.id)
      for (const [participantId, answer] of Object.entries(answers)) {
        const participant = session.participants[participantId]
        if (!participant) continue

        const correctOption = question.options.find((o) => o.isCorrect)
        const isCorrect = answer.optionId === correctOption?.id
        const timeLimitMs = question.timeLimitSecs * 1000
        const pointsEarned = isCorrect
          ? calculateScore(question.points, timeLimitMs, answer.answeredInMs)
          : 0

        answerRecords.push({
          sessionId: session.sessionId,
          participantId,
          questionId: question.id,
          optionId: answer.optionId,
          isCorrect,
          pointsEarned,
          answeredInMs: answer.answeredInMs,
          answeredAt: new Date(now.getTime() - (timeLimitMs - answer.answeredInMs)),
        })
      }
    }
  }

  await prisma.gameSession.update({
    where: { id: session.sessionId },
    data: { status: 'FINISHED', endedAt: now },
  })

  if (answerRecords.length > 0) {
    await prisma.gameAnswer.createMany({ data: answerRecords, skipDuplicates: true })
  }

  for (const participant of Object.values(session.participants)) {
    await prisma.gameParticipant.upsert({
      where: { sessionId_nickname: { sessionId: session.sessionId, nickname: participant.nickname } },
      create: {
        id: participant.id,
        sessionId: session.sessionId,
        nickname: participant.nickname,
        avatarId: participant.avatarId,
        score: participant.score,
      },
      update: { score: participant.score },
    })
  }

  if (quiz) {
    await deleteAnswers(session.pin, quiz.questions.map((q) => q.id))
  }
  await deleteSession(session.pin)
}
