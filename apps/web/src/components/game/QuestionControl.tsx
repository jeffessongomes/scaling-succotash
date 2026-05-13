'use client'
import { Button } from '@/components/ui/button'
import type { QuestionState } from '@/features/game/types'

interface QuestionControlProps {
  question: QuestionState
  answeredCount: number
  onReveal: () => void
  onEnd: () => void
}

export function QuestionControl({ question, answeredCount, onReveal, onEnd }: QuestionControlProps) {
  const progress = question.total > 0 ? (answeredCount / question.total) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p
          data-testid="text-question-index"
          className="text-sm font-semibold text-gray-500"
        >
          Pergunta {question.index + 1} de {question.total}
        </p>
        <Button
          data-testid="btn-end-game-question"
          variant="destructive"
          size="sm"
          onClick={onEnd}
        >
          Encerrar
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p
          data-testid="text-question-text"
          className="text-xl font-semibold text-gray-900"
        >
          {question.text}
        </p>
        <div className="mt-2 flex gap-4 text-sm text-gray-500">
          <span>⏱ {question.timeLimitSecs}s</span>
          <span>💎 {question.points} pts</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p
          data-testid="text-answered-count"
          className="mb-2 text-sm font-medium text-gray-700"
        >
          Responderam: {answeredCount} de {question.total}
        </p>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          data-testid="btn-reveal-answers"
          size="lg"
          onClick={onReveal}
          className="px-10"
        >
          Revelar Respostas
        </Button>
      </div>
    </div>
  )
}
