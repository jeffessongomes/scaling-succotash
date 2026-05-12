import { z } from 'zod'

export const OPTION_COLORS = ['RED', 'BLUE', 'YELLOW', 'GREEN'] as const
export type OptionColor = (typeof OPTION_COLORS)[number]

export const CreateOptionSchema = z.object({
  text: z.string().min(1, 'Texto obrigatório').max(200, 'Máximo 200 caracteres'),
  isCorrect: z.boolean(),
  color: z.enum(OPTION_COLORS),
})

export type CreateOptionInput = z.infer<typeof CreateOptionSchema>
