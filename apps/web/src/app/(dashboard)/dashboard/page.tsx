'use client'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useQuizzes } from '@/features/quiz/hooks/useQuizzes'
import { ROUTES } from '@/constants/routes'

export default function DashboardPage() {
  const { data: quizzes = [], isLoading } = useQuizzes()

  const total = quizzes.length
  const published = quizzes.filter((q) => q.isPublished).length
  const drafts = total - published

  const recentQuizzes = quizzes.slice(0, 5)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          data-testid="btn-create-quiz"
          href={ROUTES.QUIZ_CREATE}
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          Criar Novo Quiz
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div
          data-testid="card-total-quizzes"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-gray-500">Total de Quizzes</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {isLoading ? '—' : total}
          </p>
        </div>
        <div
          data-testid="card-published-quizzes"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-gray-500">Publicados</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {isLoading ? '—' : published}
          </p>
        </div>
        <div
          data-testid="card-draft-quizzes"
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm text-gray-500">Rascunhos</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">
            {isLoading ? '—' : drafts}
          </p>
        </div>
      </div>

      {recentQuizzes.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Quizzes recentes
          </h2>
          <div className="space-y-2">
            {recentQuizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={ROUTES.QUIZ_DETAIL(quiz.id)}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{quiz.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    quiz.isPublished
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {quiz.isPublished ? 'Publicado' : 'Rascunho'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
