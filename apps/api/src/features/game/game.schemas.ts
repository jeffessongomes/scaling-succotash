import { z } from 'zod'

export const CreateSessionBodySchema = z.object({
  quizId: z.string().min(1),
})

export const PlayerJoinSchema = z.object({
  pin: z.string().length(6),
  nickname: z.string().min(1).max(30),
  avatarId: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']),
})

export const PlayerAnswerSchema = z.object({
  pin: z.string().length(6),
  questionId: z.string().min(1),
  optionId: z.string().min(1),
  answeredInMs: z.number().int().min(0),
})

export const HostActionSchema = z.object({
  pin: z.string().length(6),
})

export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>
export type PlayerJoinInput = z.infer<typeof PlayerJoinSchema>
export type PlayerAnswerInput = z.infer<typeof PlayerAnswerSchema>
export type HostActionInput = z.infer<typeof HostActionSchema>
