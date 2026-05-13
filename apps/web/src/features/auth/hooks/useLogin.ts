'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'

export function useLogin() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function login(email: string, password: string) {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError('Credenciais inválidas')
      } else {
        router.push(ROUTES.DASHBOARD)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { login, error, isLoading }
}
