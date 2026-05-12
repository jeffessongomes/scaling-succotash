import { z } from 'zod'

export const CreateQuestionBodySchema = z
  .object({
    text: z.string().min(1).max(500),
    mediaType: z.enum(['IMAGE', 'VIDEO']).optional(),
    mediaUrl: z.string().url().optional(),
    timeLimitSecs: z.number().int().min(5).max(120).default(30),
    points: z.number().int().min(100).max(2000).default(1000),
    order: z.number().int().positive().optional(),
  })
  .refine((d) => !(d.mediaUrl && !d.mediaType) && !(d.mediaType && !d.mediaUrl), {
    message: 'mediaType e mediaUrl devem ser fornecidos juntos',
  })

export const UpdateQuestionBodySchema = z
  .object({
    text: z.string().min(1).max(500).optional(),
    mediaType: z.enum(['IMAGE', 'VIDEO']).nullable().optional(),
    mediaUrl: z.string().url().nullable().optional(),
    timeLimitSecs: z.number().int().min(5).max(120).optional(),
    points: z.number().int().min(100).max(2000).optional(),
    order: z.number().int().positive().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Ao menos um campo deve ser fornecido',
  })

export const ReorderQuestionBodySchema = z.object({
  order: z.number().int().positive(),
})

export type CreateQuestionBody = z.infer<typeof CreateQuestionBodySchema>
export type UpdateQuestionBody = z.infer<typeof UpdateQuestionBodySchema>
export type ReorderQuestionBody = z.infer<typeof ReorderQuestionBodySchema>
