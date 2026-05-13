'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useHostGame } from '@/features/game/hooks/useHostGame'
import { WaitingLobby } from '@/components/game/WaitingLobby'
import { QuestionControl } from '@/components/game/QuestionControl'
import { AnswerReveal } from '@/components/game/AnswerReveal'
import { LeaderboardView } from '@/components/game/LeaderboardView'
import { FinishedView } from '@/components/game/FinishedView'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ROUTES } from '@/constants/routes'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export default function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const game = useHostGame(id)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)

  function handleEndRequest() {
    setConfirmEndOpen(true)
  }

  function handleEndConfirm() {
    game.endGame()
    setConfirmEndOpen(false)
  }

  const isLastQuestion =
    game.currentQuestion !== null &&
    game.currentQuestion.index === game.currentQuestion.total - 1

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        {game.session ? (
          <p className="text-sm font-semibold text-gray-900">{game.session.quizTitle}</p>
        ) : (
          <Link
            href={ROUTES.QUIZZES}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Cancelar
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {game.isConnecting && !game.connectionError && (
          <div
            data-testid="banner-connecting"
            className="mb-6 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          >
            Conectando…
          </div>
        )}

        {game.connectionError && (
          <div
            data-testid="banner-connection-error"
            className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {game.connectionError}
          </div>
        )}

        {!game.session && !game.connectionError && !game.isConnecting && (
          <div
            data-testid="banner-connecting"
            className="mb-6 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
          >
            Criando sessão…
          </div>
        )}

        {game.session && (
          <>
            {game.phase === 'lobby' && (
              <WaitingLobby
                session={game.session}
                players={game.players}
                onStart={game.startGame}
                appUrl={APP_URL}
              />
            )}

            {game.phase === 'question' && game.currentQuestion && (
              <QuestionControl
                question={game.currentQuestion}
                answeredCount={game.answeredCount}
                onReveal={game.revealAnswers}
                onEnd={handleEndRequest}
              />
            )}

            {game.phase === 'results' && game.currentQuestion && game.answerStats && (
              <AnswerReveal
                question={game.currentQuestion}
                stats={game.answerStats}
                isLastQuestion={isLastQuestion}
                onShowLeaderboard={game.showLeaderboard}
                onNextQuestion={game.nextQuestion}
                onEnd={handleEndRequest}
              />
            )}

            {game.phase === 'leaderboard' && (
              <LeaderboardView
                leaderboard={game.leaderboard}
                isLastQuestion={isLastQuestion}
                onNextQuestion={game.nextQuestion}
                onEnd={handleEndRequest}
              />
            )}

            {game.phase === 'finished' && (
              <FinishedView leaderboard={game.leaderboard} />
            )}
          </>
        )}
      </main>

      <ConfirmDialog
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        title="Encerrar partida?"
        description="Todos os jogadores serão desconectados e a partida será finalizada. Esta ação não pode ser desfeita."
        confirmLabel="Encerrar"
        cancelLabel="Cancelar"
        onConfirm={handleEndConfirm}
      />
    </div>
  )
}
