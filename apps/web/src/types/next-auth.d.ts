import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: 'TEACHER' | 'ADMIN' } & DefaultSession['user']
    accessToken: string
  }
  interface User {
    role: 'TEACHER' | 'ADMIN'
    accessToken: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string
    role: 'TEACHER' | 'ADMIN'
    accessToken: string
  }
}
