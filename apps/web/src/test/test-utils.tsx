import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, PropsWithChildren } from 'react'

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

const Providers = ({ children }: PropsWithChildren) => {
  const client = makeTestQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: Providers, ...options })

export * from '@testing-library/react'
export { customRender as render }
export { userEvent }
