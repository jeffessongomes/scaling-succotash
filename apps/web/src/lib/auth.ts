import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

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
        return res.json() as Promise<{
          id: string
          name: string
          email: string
          role: 'TEACHER' | 'ADMIN'
        }>
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: 'TEACHER' | 'ADMIN' }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'TEACHER' | 'ADMIN'
      return session
    },
  },
  pages: { signIn: '/login' },
})
