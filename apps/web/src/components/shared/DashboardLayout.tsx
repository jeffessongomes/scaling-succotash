'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'
import type { PropsWithChildren } from 'react'

const NAV_ITEMS = [
  { href: ROUTES.DASHBOARD, label: 'Dashboard' },
  { href: ROUTES.QUIZZES, label: 'Meus Quizzes' },
] as const

export function DashboardLayout({ children }: PropsWithChildren) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-4">
          <span className="text-lg font-bold text-gray-900">Azimute</span>
        </div>
        <nav className="p-3">
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <span className="text-sm text-gray-500">Bem-vindo,</span>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-900">{session?.user?.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: ROUTES.LOGIN })}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
