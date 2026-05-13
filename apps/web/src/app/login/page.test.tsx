import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, userEvent } from '@/test/test-utils'
import LoginPage from './page'

const { mockLogin, mockUseLogin, mockRouterPush } = vi.hoisted(() => {
  const mockLogin = vi.fn()
  return {
    mockLogin,
    mockUseLogin: vi.fn(() => ({ login: mockLogin, error: null as string | null, isLoading: false })),
    mockRouterPush: vi.fn(),
  }
})

vi.mock('@/features/auth/hooks/useLogin', () => ({
  useLogin: mockUseLogin,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
  usePathname: vi.fn().mockReturnValue('/login'),
}))

beforeEach(() => {
  mockLogin.mockResolvedValue(undefined)
  mockUseLogin.mockReturnValue({ login: mockLogin, error: null, isLoading: false })
})

describe('LoginPage', () => {
  it('should render email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByTestId('input-user-email')).toBeInTheDocument()
    expect(screen.getByTestId('input-user-password')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-login')).toBeInTheDocument()
  })

  describe('when valid credentials are submitted', () => {
    it('should call login with email and password', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      await user.type(screen.getByTestId('input-user-email'), 'professor@escola.com.br')
      await user.type(screen.getByTestId('input-user-password'), 'senha123')
      await user.click(screen.getByTestId('btn-submit-login'))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('professor@escola.com.br', 'senha123')
      })
    })
  })

  describe('when invalid credentials are submitted', () => {
    it('should display error message', () => {
      mockUseLogin.mockReturnValue({ login: mockLogin, error: 'Credenciais inválidas', isLoading: false })
      render(<LoginPage />)
      expect(screen.getByTestId('text-login-error')).toHaveTextContent('Credenciais inválidas')
    })
  })

  describe('when form is submitting', () => {
    it('should disable the submit button', () => {
      mockUseLogin.mockReturnValue({ login: mockLogin, error: null, isLoading: true })
      render(<LoginPage />)
      expect(screen.getByTestId('btn-submit-login')).toBeDisabled()
    })
  })

  describe('when email field is empty', () => {
    it('should show validation error', async () => {
      const user = userEvent.setup()
      render(<LoginPage />)

      await user.click(screen.getByTestId('btn-submit-login'))

      expect(await screen.findByText('Email inválido')).toBeInTheDocument()
    })
  })
})
