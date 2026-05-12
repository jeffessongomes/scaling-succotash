import { z } from 'zod'
import type { QuestionPublic } from '../question/question.types.js'

export const CreateQuizBodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  coverImage: z.string().url().optional(),
})

export const UpdateQuizBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    coverImage: z.string().url().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Ao menos um campo deve ser fornecido',
  })

export const PublishQuizBodySchema = z.object({
  isPublished: z.boolean(),
})

export type CreateQuizBody = z.infer<typeof CreateQuizBodySchema>
export type UpdateQuizBody = z.infer<typeof UpdateQuizBodySchema>
export type PublishQuizBody = z.infer<typeof PublishQuizBodySchema>

export interface QuizSummary {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  isPublished: boolean
  authorId: string
  _count: { questions: number }
  createdAt: Date
  updatedAt: Date
}

export interface QuizDetail extends QuizSummary {
  questions: QuestionPublic[]
}
