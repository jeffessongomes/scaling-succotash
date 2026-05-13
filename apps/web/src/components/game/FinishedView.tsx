'use client'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import type { LeaderboardEntry } from '@/features/game/types'

interface FinishedViewProps {
  leaderboard: LeaderboardEntry[]
}

const MEDALS = ['🥇', '🥈', '🥉']

export function FinishedView({ leaderboard }: FinishedViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2
          data-testid="text-finished-title"
          className="text-2xl font-black text-gray-900"
        >
          Partida Encerrada
        </h2>
        <p className="mt-1 text-sm text-gray-500">Placar Final</p>
      </div>

      <div className="space-y-3">
        {leaderboard.map((entry, i) => (
          <div
            key={entry.nickname}
            data-testid={`row-final-leaderboard-${entry.nickname}`}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <span className="text-2xl">{MEDALS[i] ?? `${entry.rank}º`}</span>
            <span className="flex-1 font-semibold text-gray-900">{entry.nickname}</span>
            <span className="text-sm text-gray-500">
              {entry.score.toLocaleString('pt-BR')} pts
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Link
          data-testid="btn-back-to-dashboard"
          href={ROUTES.DASHBOARD}
          className={buttonVariants({ variant: 'default' })}
        >
          ← Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
