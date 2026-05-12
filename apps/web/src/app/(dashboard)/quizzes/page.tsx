'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useQuizzes } from '@/features/quiz/hooks/useQuizzes'
import { useQuizActions } from '@/features/quiz/hooks/useQuizActions'
import { ROUTES } from '@/constants/routes'
import type { QuizSummary } from '@/features/quiz/types'

function QuizStatusBadge({ quiz }: { quiz: QuizSummary }) {
  return (
    <span
      data-testid={`badge-quiz-status-${quiz.id}`}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
      }`}
    >
      {quiz.isPublished ? 'Publicado' : 'Rascunho'}
    </span>
  )
}

function QuizzesSkeleton() {
  return (
    <div className="space-y-3" data-testid="quizzes-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-200" />
      ))}
    </div>
  )
}

export default function QuizzesPage() {
  const { data: quizzes = [], isLoading, error, refetch } = useQuizzes()
  const { remove, publish } = useQuizActions()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  async function handlePublish(quiz: QuizSummary) {
    if (!quiz.isPublished && quiz._count.questions === 0) {
      setPublishError('O quiz precisa ter pelo menos 1 pergunta para ser publicado')
      return
    }
    setPublishError(null)
    await publish.mutateAsync({ id: quiz.id, isPublished: !quiz.isPublished })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await remove.mutateAsync(deleteTarget)
    setDeleteTarget(null)
  }

  if (isLoading) return <QuizzesSkeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Erro ao carregar quizzes.</p>
        <Button variant="outline" className="mt-3" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meus Quizzes</h1>
        <Link
          data-testid="btn-create-quiz"
          href={ROUTES.QUIZ_CREATE}
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          Novo Quiz
        </Link>
      </div>

      {publishError && (
        <div
          data-testid="text-publish-error"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {publishError}
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">Nenhum quiz ainda.</p>
          <Link
            href={ROUTES.QUIZ_CREATE}
            className={cn(buttonVariants({ variant: 'default' }), 'mt-4')}
          >
            Criar seu primeiro quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <QuizStatusBadge quiz={quiz} />
                <span className="font-medium text-gray-900">{quiz.title}</span>
                <span className="text-xs text-gray-400">
                  {quiz._count.questions} pergunta{quiz._count.questions !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  data-testid={`btn-publish-quiz-${quiz.id}`}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePublish(quiz)}
                  disabled={publish.isPending}
                >
                  {quiz.isPublished ? 'Despublicar' : 'Publicar'}
                </Button>
                <Link
                  data-testid={`btn-edit-quiz-${quiz.id}`}
                  href={ROUTES.QUIZ_DETAIL(quiz.id)}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  Editar
                </Link>
                <Button
                  data-testid={`btn-delete-quiz-${quiz.id}`}
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteTarget(quiz.id)}
                >
                  Deletar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Deletar quiz"
        description="Tem certeza? Todas as perguntas e opções serão deletadas permanentemente."
        confirmLabel="Deletar"
        onConfirm={handleConfirmDelete}
        isLoading={remove.isPending}
      />
    </div>
  )
}
