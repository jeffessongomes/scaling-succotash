import { z } from 'zod'

export const CreateQuestionSchema = z.object({
  text: z.string().min(1, 'Texto obrigatório').max(500, 'Máximo 500 caracteres'),
  timeLimitSecs: z.coerce
    .number()
    .int()
    .min(5, 'Mínimo 5 segundos')
    .max(120, 'Máximo 120 segundos')
    .default(30),
  points: z.coerce
    .number()
    .int()
    .min(100, 'Mínimo 100 pontos')
    .max(2000, 'Máximo 2000 pontos')
    .default(1000),
})

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>
