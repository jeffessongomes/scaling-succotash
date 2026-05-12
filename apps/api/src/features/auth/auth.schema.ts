import { z } from 'zod'

export const RegisterBodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterBody = z.infer<typeof RegisterBodySchema>
export type LoginBody = z.infer<typeof LoginBodySchema>
