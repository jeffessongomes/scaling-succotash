import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

describe('socket', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should create socket with autoConnect disabled', async () => {
    const { io } = await import('socket.io-client')
    await import('./socket')

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ autoConnect: false }),
    )
  })

  it('should use websocket transport', async () => {
    const { io } = await import('socket.io-client')
    await import('./socket')

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ transports: ['websocket'] }),
    )
  })

  it('should not be connected on import', async () => {
    const { socket } = await import('./socket')

    expect(socket.connected).toBe(false)
  })
})
