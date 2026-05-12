import http from 'http'
import { Server } from 'socket.io'
import { createApp } from './app.js'
import { env } from './config/env.js'

async function bootstrap() {
  const app = createApp()
  const server = http.createServer(app)

  const _io = new Server(server, {
    cors: { origin: env.NEXTAUTH_URL },
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${env.API_PORT} is already in use. Choose a different port.`)
      process.exit(1)
    }
    console.error('Server error:', err)
    process.exit(1)
  })

  server.listen(env.API_PORT, () => {
    console.log(`🚀 API running on http://localhost:${env.API_PORT}`)
    console.log(`🔗 Health check: http://localhost:${env.API_PORT}/health`)
  })
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err)
  process.exit(1)
})
