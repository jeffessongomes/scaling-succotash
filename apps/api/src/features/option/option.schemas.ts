import { z } from 'zod'

export const CreateOptionBodySchema = z.object({
  text: z.string().min(1).max(200),
  isCorrect: z.boolean(),
  color: z.enum(['RED', 'BLUE', 'YELLOW', 'GREEN']),
  order: z.number().int().positive().optional(),
})

export const UpdateOptionBodySchema = z
  .object({
    text: z.string().min(1).max(200).optional(),
    isCorrect: z.boolean().optional(),
    color: z.enum(['RED', 'BLUE', 'YELLOW', 'GREEN']).optional(),
    order: z.number().int().positive().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Ao menos um campo deve ser fornecido',
  })

export type CreateOptionBody = z.infer<typeof CreateOptionBodySchema>
export type UpdateOptionBody = z.infer<typeof UpdateOptionBodySchema>
