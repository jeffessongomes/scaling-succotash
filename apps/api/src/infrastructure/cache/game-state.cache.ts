import { redis } from '../../config/redis.js'
import { env } from '../../config/env.js'
import type { GameSessionState } from '../../features/game/game.types.js'

export async function saveSession(session: GameSessionState): Promise<void> {
  await redis.set(
    `game:session:${session.pin}`,
    JSON.stringify(session),
    'EX',
    env.GAME_SESSION_TTL,
  )
}

export async function getSession(pin: string): Promise<GameSessionState | null> {
  const raw = await redis.get(`game:session:${pin}`)
  if (!raw) return null
  return JSON.parse(raw) as GameSessionState
}

export async function deleteSession(pin: string): Promise<void> {
  await redis.del(
    `game:session:${pin}`,
    `game:scores:${pin}`,
  )
}

export async function deleteAnswers(pin: string, questionIds: string[]): Promise<void> {
  if (questionIds.length === 0) return
  const keys = questionIds.map((qId) => `game:answers:${pin}:${qId}`)
  await redis.del(...keys)
}

export async function saveAnswer(
  pin: string,
  questionId: string,
  participantId: string,
  answeredInMs: number,
): Promise<boolean> {
  const result = await redis.hsetnx(
    `game:answers:${pin}:${questionId}`,
    participantId,
    String(answeredInMs),
  )
  return result === 1
}

export async function updateScore(pin: string, participantId: string, score: number): Promise<void> {
  await redis.zadd(`game:scores:${pin}`, score, participantId)
}

export async function getAnswers(pin: string, questionId: string): Promise<Record<string, number>> {
  const raw = await redis.hgetall(`game:answers:${pin}:${questionId}`)
  const result: Record<string, number> = {}
  for (const [participantId, ms] of Object.entries(raw)) {
    result[participantId] = Number(ms)
  }
  return result
}
