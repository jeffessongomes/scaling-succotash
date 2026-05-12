'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import type { PropsWithChildren } from 'react'
import { getQueryClient } from '@/lib/query-client'

export function Providers({ children }: PropsWithChildren) {
  const queryClient = getQueryClient()
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  )
}
