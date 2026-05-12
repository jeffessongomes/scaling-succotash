import { Redis } from 'ioredis'

export const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
})

redis.on('error', (err: Error) => {
  if (process.env['NODE_ENV'] !== 'test') {
    console.error('Redis connection error:', err.message)
  }
})
