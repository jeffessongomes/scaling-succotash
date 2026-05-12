import type { Redis } from 'ioredis'

const MAX_ATTEMPTS = 10

export async function generateUniquePin(redis: Redis): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    const exists = await redis.exists(`game:session:${pin}`)
    if (exists === 0) return pin
  }
  throw new Error(`Could not generate a unique PIN after ${MAX_ATTEMPTS} attempts`)
}
