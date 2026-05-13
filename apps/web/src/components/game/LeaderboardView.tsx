'use client'
import { Button } from '@/components/ui/button'
import type { LeaderboardEntry } from '@/features/game/types'

interface LeaderboardViewProps {
  leaderboard: LeaderboardEntry[]
  isLastQuestion: boolean
  onNextQuestion: () => void
  onEnd: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export function LeaderboardView({
  leaderboard,
  isLastQuestion,
  onNextQuestion,
  onEnd,
}: LeaderboardViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-gray-900">Placar Parcial</p>
        <Button
          data-testid="btn-end-game-leaderboard"
          variant="destructive"
          size="sm"
          onClick={onEnd}
        >
          Encerrar
        </Button>
      </div>

      <div className="space-y-3">
        {leaderboard.map((entry, i) => (
          <div
            key={entry.nickname}
            data-testid={`row-leaderboard-${entry.nickname}`}
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
        {isLastQuestion ? (
          <Button
            data-testid="btn-end-game-final"
            variant="destructive"
            size="lg"
            onClick={onEnd}
            className="px-10"
          >
            Encerrar Partida
          </Button>
        ) : (
          <Button
            data-testid="btn-next-question"
            size="lg"
            onClick={onNextQuestion}
            className="px-10"
          >
            Próxima Pergunta ▶
          </Button>
        )}
      </div>
    </div>
  )
}
