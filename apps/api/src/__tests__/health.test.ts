import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

vi.mock('../config/database.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../config/redis.js', () => ({
  redis: {
    ping: vi.fn(),
  },
}))

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 200 with status ok when services are available', async () => {
    const { prisma } = await import('../config/database.js')
    const { redis } = await import('../config/redis.js')
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }])
    vi.mocked(redis.ping).mockResolvedValueOnce('PONG')

    const { createApp } = await import('../app.js')
    const app = createApp()
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.services.postgres).toBe(true)
    expect(response.body.services.redis).toBe(true)
    expect(response.body.timestamp).toBeDefined()
    expect(response.body.version).toBe('0.1.0')
  })

  it('should return 503 with status degraded when postgres is down', async () => {
    const { prisma } = await import('../config/database.js')
    const { redis } = await import('../config/redis.js')
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'))
    vi.mocked(redis.ping).mockResolvedValueOnce('PONG')

    const { createApp } = await import('../app.js')
    const app = createApp()
    const response = await request(app).get('/health')

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('degraded')
    expect(response.body.services.postgres).toBe(false)
    expect(response.body.services.redis).toBe(true)
  })

  it('should return 503 with status degraded when redis is down', async () => {
    const { prisma } = await import('../config/database.js')
    const { redis } = await import('../config/redis.js')
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }])
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { createApp } = await import('../app.js')
    const app = createApp()
    const response = await request(app).get('/health')

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('degraded')
    expect(response.body.services.postgres).toBe(true)
    expect(response.body.services.redis).toBe(false)
  })
})
