import { z } from 'zod'

export const CreateQuizSchema = z.object({
  title: z.string().min(1, 'Título obrigatório').max(200, 'Máximo 200 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
})

export const UpdateQuizSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Ao menos um campo é obrigatório' })

export type CreateQuizInput = z.infer<typeof CreateQuizSchema>
export type UpdateQuizInput = z.infer<typeof UpdateQuizSchema>
