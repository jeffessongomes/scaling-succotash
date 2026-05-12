import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

interface BackendLoginResponse {
  token: string
  user: { id: string; name: string; email: string; role: 'TEACHER' | 'ADMIN' }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const res = await fetch(
          `${process.env['NEXT_PUBLIC_API_URL']}/auth/login`,
          {
            method: 'POST',
            body: JSON.stringify(credentials),
            headers: { 'Content-Type': 'application/json' },
          },
        )
        if (!res.ok) return null
        const data = (await res.json()) as BackendLoginResponse
        return {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          accessToken: data.token,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: 'TEACHER' | 'ADMIN' }).role
        token.accessToken = (user as { accessToken: string }).accessToken
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'TEACHER' | 'ADMIN'
      session.accessToken = token.accessToken as string
      return session
    },
  },
  pages: { signIn: '/login' },
})
