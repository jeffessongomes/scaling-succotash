'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { LoginSchema, type LoginInput } from '@/features/auth/schemas/login.schema'

export default function LoginPage() {
  const { login, error, isLoading } = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Azimute</h1>
          <p className="mt-1 text-sm text-gray-500">Quiz interativo para viagens escolares</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Entrar</h2>

          <form onSubmit={handleSubmit(({ email, password }) => login(email, password))}>
            <div className="mb-4">
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                data-testid="input-user-email"
                type="email"
                {...register('email')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="professor@escola.com.br"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                data-testid="input-user-password"
                type="password"
                {...register('password')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <p
                data-testid="text-login-error"
                className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            <Button
              data-testid="btn-submit-login"
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
