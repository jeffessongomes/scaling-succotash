import { z } from 'zod'

export const PlayerJoinSchema = z.object({
  pin: z.string().length(6),
  nickname: z.string().min(1).max(20),
  avatarId: z.string().min(1),
})

export const PlayerAnswerSchema = z.object({
  pin: z.string().length(6),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
  answeredInMs: z.number().int().min(0),
})

export const GameActionSchema = z.object({
  pin: z.string().length(6),
})

export type PlayerJoin = z.infer<typeof PlayerJoinSchema>
export type PlayerAnswer = z.infer<typeof PlayerAnswerSchema>
export type GameAction = z.infer<typeof GameActionSchema>
