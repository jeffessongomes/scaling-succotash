'use client'
import { Button } from '@/components/ui/button'
import type { QuestionState, AnswerStats } from '@/features/game/types'

interface AnswerRevealProps {
  question: QuestionState
  stats: AnswerStats
  isLastQuestion: boolean
  onShowLeaderboard: () => void
  onNextQuestion: () => void
  onEnd: () => void
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export function AnswerReveal({
  question,
  stats,
  isLastQuestion,
  onShowLeaderboard,
  onNextQuestion,
  onEnd,
}: AnswerRevealProps) {
  const totalAnswers = Object.values(stats.stats).reduce((sum, n) => sum + n, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-500">
          Pergunta {question.index + 1} de {question.total}
        </p>
        <Button
          data-testid="btn-end-game-reveal"
          variant="destructive"
          size="sm"
          onClick={onEnd}
        >
          Encerrar
        </Button>
      </div>

      <div className="space-y-3">
        {Object.entries(stats.stats).map(([optionId, count], i) => {
          const isCorrect = optionId === stats.correctOptionId
          const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0

          return (
            <div
              key={optionId}
              data-testid={`row-answer-option-${optionId}`}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                isCorrect
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span
                className={`text-lg ${isCorrect ? 'text-green-600' : 'text-gray-400'}`}
              >
                {isCorrect ? '✅' : '❌'}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-700">
                {OPTION_LABELS[i] ?? optionId}
              </span>
              <span className="text-sm text-gray-500">
                {count} ({percentage}%)
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center gap-3">
        <Button
          data-testid="btn-show-leaderboard"
          variant="outline"
          size="lg"
          onClick={onShowLeaderboard}
        >
          Ver Placar
        </Button>
        {!isLastQuestion && (
          <Button
            data-testid="btn-next-question"
            size="lg"
            onClick={onNextQuestion}
          >
            Próxima Pergunta ▶
          </Button>
        )}
      </div>
    </div>
  )
}
