import jwt from 'jsonwebtoken'
import type { Server, Socket } from 'socket.io'
import { env } from '../../config/env.js'
import {
  saveSession,
  getSession,
  saveAnswer,
  updateScore,
  getAnswers,
} from '../../infrastructure/cache/game-state.cache.js'
import { finalizeSession } from './game.service.js'
import { assertTransition, InvalidTransitionError } from './game.state-machine.js'
import { calculateScore } from '../../shared/utils/scoring.js'
import {
  PlayerJoinSchema,
  PlayerAnswerSchema,
  HostActionSchema,
} from './game.schemas.js'
import type { GameSessionState, ParticipantScore } from './game.types.js'
import { prisma } from '../../config/database.js'

interface JwtPayload {
  sub: string
}

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>()
const activeIntervals = new Map<string, ReturnType<typeof setInterval>>()
const hostReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearGameTimers(pin: string): void {
  const timer = activeTimers.get(pin)
  if (timer) {
    clearTimeout(timer)
    activeTimers.delete(pin)
  }
  const interval = activeIntervals.get(pin)
  if (interval) {
    clearInterval(interval)
    activeIntervals.delete(pin)
  }
}

function buildLeaderboard(session: GameSessionState): ParticipantScore[] {
  return Object.values(session.participants)
    .sort((a, b) => b.score - a.score)
    .map((p, idx) => ({ id: p.id, nickname: p.nickname, avatarId: p.avatarId, score: p.score, rank: idx + 1 }))
}

async function emitSessionError(socket: Socket, code: string, message: string): Promise<void> {
  socket.emit('session:error', { code, message })
}

async function getSessionOrError(socket: Socket, pin: string): Promise<GameSessionState | null> {
  const session = await getSession(pin)
  if (!session) {
    await emitSessionError(socket, 'SESSION_EXPIRED', 'Sessão não encontrada ou expirada')
    return null
  }
  return session
}

async function handleQuestionStart(io: Server, session: GameSessionState): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: session.quizId },
    select: {
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
            select: { id: true, text: true, color: true, order: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!quiz || quiz.questions.length === 0) return

  const question = quiz.questions[session.currentQuestionIndex]
  if (!question) return

  const now = Date.now()
  session.questionStartedAt = now
  await saveSession(session)

  const timeLimitMs = question.timeLimitSecs * 1000

  io.to(`game:${session.pin}`).emit('session:question-start', {
    question: {
      id: question.id,
      text: question.text,
      mediaType: question.mediaType,
      mediaUrl: question.mediaUrl,
      order: question.order,
      options: question.options,
    },
    questionIndex: session.currentQuestionIndex,
    totalQuestions: quiz.questions.length,
    timeLimitSecs: question.timeLimitSecs,
    questionStartedAt: now,
  })

  const tickInterval = setInterval(() => {
    const elapsed = Date.now() - now
    const remainingMs = Math.max(0, timeLimitMs - elapsed)
    io.to(`game:${session.pin}`).emit('session:timer-tick', { remainingMs })
  }, 1000)
  activeIntervals.set(session.pin, tickInterval)

  const autoRevealTimer = setTimeout(async () => {
    clearInterval(tickInterval)
    activeIntervals.delete(session.pin)
    activeTimers.delete(session.pin)

    const current = await getSession(session.pin)
    if (!current || current.status !== 'QUESTION') return

    await revealAnswers(io, current, question.id, '')
  }, timeLimitMs)

  activeTimers.set(session.pin, autoRevealTimer)
}

async function revealAnswers(
  io: Server,
  session: GameSessionState,
  questionId: string,
  _correctOptionId: string,
): Promise<void> {
  const quiz = await prisma.quiz.findUnique({
    where: { id: session.quizId },
    select: {
      questions: {
        where: { id: questionId },
        select: {
          id: true,
          points: true,
          timeLimitSecs: true,
          options: { select: { id: true, isCorrect: true } },
        },
      },
    },
  })

  const question = quiz?.questions[0]
  if (!question) return

  const correctOption = question.options.find((o) => o.isCorrect)
  const correctOptionId = correctOption?.id ?? ''
  const timeLimitMs = question.timeLimitSecs * 1000

  clearGameTimers(session.pin)

  const answers = await getAnswers(session.pin, questionId)
  const distribution: Record<string, number> = {}
  for (const optId of question.options.map((o) => o.id)) {
    distribution[optId] = 0
  }

  for (const [participantId, answer] of Object.entries(answers)) {
    const participant = session.participants[participantId]
    if (!participant) continue

    const isCorrect = answer.optionId === correctOptionId
    if (isCorrect) {
      const points = calculateScore(question.points, timeLimitMs, answer.answeredInMs)
      participant.score += points
      await updateScore(session.pin, participantId, participant.score)
    }
    if (answer.optionId in distribution) {
      distribution[answer.optionId] = (distribution[answer.optionId] ?? 0) + 1
    }
  }

  session.status = 'REVEAL'
  await saveSession(session)

  const participants = buildLeaderboard(session)

  io.to(`game:${session.pin}`).emit('session:answers-revealed', {
    correctOptionId,
    distribution,
    participants,
  })
}

export function setupGameSocket(io: Server): void {
  const gameNs = io.of('/game')

  gameNs.on('connection', (socket: Socket) => {
    let hostUserId: string | null = null

    const authToken = (socket.handshake.auth as Record<string, string>)['token']
    if (authToken) {
      try {
        const payload = jwt.verify(authToken, env.JWT_SECRET) as JwtPayload
        hostUserId = payload.sub
      } catch {
        // not authenticated as host — player connection
      }
    }

    socket.on('player:join', async (rawPayload: unknown) => {
      const parsed = PlayerJoinSchema.safeParse(rawPayload)
      if (!parsed.success) {
        await emitSessionError(socket, 'INVALID_PAYLOAD', 'Payload inválido')
        return
      }
      const { pin, nickname, avatarId } = parsed.data

      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (!['LOBBY'].includes(session.status)) {
        await emitSessionError(socket, 'SESSION_NOT_ACCEPTING', 'A sessão não está aceitando jogadores')
        return
      }

      const existingByNickname = Object.values(session.participants).find(
        (p) => p.nickname === nickname,
      )

      if (existingByNickname) {
        if (existingByNickname.isConnected) {
          await emitSessionError(socket, 'NICKNAME_TAKEN', 'Nickname já em uso')
          return
        }
        existingByNickname.socketId = socket.id
        existingByNickname.isConnected = true
      } else {
        const participantId = `${session.sessionId}-${nickname}`
        session.participants[participantId] = {
          id: participantId,
          nickname,
          avatarId,
          score: 0,
          socketId: socket.id,
          isConnected: true,
        }
      }

      await saveSession(session)
      await socket.join(`game:${pin}`)

      const participant = existingByNickname ?? session.participants[`${session.sessionId}-${nickname}`]
      const totalPlayers = Object.keys(session.participants).length

      gameNs.to(`game:${pin}`).emit('session:player-joined', { participant, totalPlayers })
    })

    socket.on('host:join', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (session.hostSocketId && session.hostSocketId !== socket.id) {
        const existingTimer = hostReconnectTimers.get(pin)
        if (!existingTimer) {
          await emitSessionError(socket, 'HOST_ALREADY_CONNECTED', 'Host já conectado')
          return
        }
      }

      const reconnectTimer = hostReconnectTimers.get(pin)
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        hostReconnectTimers.delete(pin)
      }

      session.hostSocketId = socket.id
      session.hostDisconnectedAt = null
      await saveSession(session)
      await socket.join(`game:${pin}`)
    })

    socket.on('game:start', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (socket.id !== session.hostSocketId) {
        await emitSessionError(socket, 'NOT_HOST', 'Apenas o host pode iniciar o jogo')
        return
      }

      if (Object.keys(session.participants).length === 0) {
        await emitSessionError(socket, 'NO_PLAYERS', 'Não há jogadores na sessão')
        return
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: session.quizId },
        select: { questions: { select: { id: true } } },
      })
      if (!quiz || quiz.questions.length === 0) {
        await emitSessionError(socket, 'QUIZ_EMPTY', 'O quiz não tem perguntas')
        return
      }

      try {
        assertTransition(session.status, 'ACTIVE')
        session.status = 'ACTIVE'
        assertTransition(session.status, 'QUESTION')
        session.status = 'QUESTION'
        await saveSession(session)
        await handleQuestionStart(gameNs as unknown as Server, session)
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          await emitSessionError(socket, 'INVALID_TRANSITION', err.message)
        }
      }
    })

    socket.on('game:next-question', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (socket.id !== session.hostSocketId) {
        await emitSessionError(socket, 'NOT_HOST', 'Apenas o host pode avançar a pergunta')
        return
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: session.quizId },
        select: { questions: { select: { id: true } } },
      })

      const nextIndex = session.currentQuestionIndex + 1
      if (!quiz || nextIndex >= quiz.questions.length) {
        await emitSessionError(socket, 'NO_MORE_QUESTIONS', 'Não há mais perguntas')
        return
      }

      try {
        assertTransition(session.status, 'QUESTION')
        session.status = 'QUESTION'
        session.currentQuestionIndex = nextIndex
        await saveSession(session)
        await handleQuestionStart(gameNs as unknown as Server, session)
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          await emitSessionError(socket, 'INVALID_TRANSITION', err.message)
        }
      }
    })

    socket.on('game:reveal-answers', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (socket.id !== session.hostSocketId) {
        await emitSessionError(socket, 'NOT_HOST', 'Apenas o host pode revelar respostas')
        return
      }

      try {
        assertTransition(session.status, 'REVEAL')
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          await emitSessionError(socket, 'INVALID_TRANSITION', err.message)
        }
        return
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: session.quizId },
        select: { questions: { select: { id: true }, orderBy: { order: 'asc' } } },
      })
      const questionId = quiz?.questions[session.currentQuestionIndex]?.id
      if (!questionId) return

      await revealAnswers(gameNs as unknown as Server, session, questionId, '')
    })

    socket.on('game:show-leaderboard', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (socket.id !== session.hostSocketId) {
        await emitSessionError(socket, 'NOT_HOST', 'Apenas o host pode mostrar o placar')
        return
      }

      try {
        assertTransition(session.status, 'LEADERBOARD')
        session.status = 'LEADERBOARD'
        await saveSession(session)
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          await emitSessionError(socket, 'INVALID_TRANSITION', err.message)
          return
        }
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: session.quizId },
        select: { questions: { select: { id: true } } },
      })

      const ranking = buildLeaderboard(session)
      gameNs.to(`game:${pin}`).emit('session:leaderboard', {
        ranking,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: quiz?.questions.length ?? 0,
      })
    })

    socket.on('game:end', async (rawPayload: unknown) => {
      const parsed = HostActionSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin } = parsed.data
      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (socket.id !== session.hostSocketId) {
        await emitSessionError(socket, 'NOT_HOST', 'Apenas o host pode encerrar o jogo')
        return
      }

      clearGameTimers(pin)

      const ranking = buildLeaderboard(session)
      session.status = 'FINISHED'

      await finalizeSession(session)

      gameNs.to(`game:${pin}`).emit('session:ended', { ranking })
    })

    socket.on('player:answer', async (rawPayload: unknown) => {
      const parsed = PlayerAnswerSchema.safeParse(rawPayload)
      if (!parsed.success) return

      const { pin, questionId, optionId, answeredInMs } = parsed.data

      const session = await getSessionOrError(socket, pin)
      if (!session) return

      if (session.status !== 'QUESTION') return

      const participant = Object.values(session.participants).find(
        (p) => p.socketId === socket.id,
      )
      if (!participant) return

      const quiz = await prisma.quiz.findUnique({
        where: { id: session.quizId },
        select: {
          questions: {
            where: { id: questionId },
            select: { timeLimitSecs: true },
          },
        },
      })
      const question = quiz?.questions[0]
      if (!question) return

      const timeLimitMs = question.timeLimitSecs * 1000
      if (answeredInMs > timeLimitMs) return

      const saved = await saveAnswer(pin, questionId, participant.id, optionId, answeredInMs)
      if (!saved) return

      const answeredCount = Object.keys(await getAnswers(pin, questionId)).length
      const totalPlayers = Object.keys(session.participants).length

      const hostSocket = gameNs.sockets.get(session.hostSocketId)
      if (hostSocket) {
        hostSocket.emit('session:answer-received', { answeredCount, totalPlayers })
      }
    })

    socket.on('disconnect', async () => {
      for (const [pin, session] of await getAllActiveSessions()) {
        if (session.hostSocketId === socket.id) {
          session.hostDisconnectedAt = Date.now()
          await saveSession(session)

          const timer = setTimeout(async () => {
            hostReconnectTimers.delete(pin)
            const current = await getSession(pin)
            if (!current || current.hostSocketId !== socket.id) return

            clearGameTimers(pin)
            gameNs.to(`game:${pin}`).emit('session:error', {
              code: 'HOST_DISCONNECTED',
              message: 'O host se desconectou',
            })
            current.status = 'FINISHED'
            await finalizeSession(current)
          }, 30_000)

          hostReconnectTimers.set(pin, timer)
          return
        }

        const participant = Object.values(session.participants).find(
          (p) => p.socketId === socket.id,
        )
        if (participant) {
          participant.isConnected = false
          await saveSession(session)
          return
        }
      }
    })

    void hostUserId
  })
}

async function getAllActiveSessions(): Promise<[string, GameSessionState][]> {
  return []
}
