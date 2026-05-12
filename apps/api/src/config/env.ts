import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  NEXTAUTH_URL: z.string().default('http://localhost:3000'),
  UPLOADS_PATH: z.string().default('/app/uploads'),
  UPLOAD_MAX_IMAGE_SIZE: z.coerce.number().default(5242880),
  UPLOAD_MAX_VIDEO_SIZE: z.coerce.number().default(52428800),
  GAME_SESSION_TTL: z.coerce.number().default(14400),
  GAME_WS_RATE_LIMIT: z.coerce.number().default(10),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌ Invalid environment variables:')
  const errors = result.error.flatten().fieldErrors
  for (const [key, messages] of Object.entries(errors)) {
    console.error(`  ${key}: ${messages?.join(', ')}`)
  }
  process.exit(1)
}

export const env = result.data
