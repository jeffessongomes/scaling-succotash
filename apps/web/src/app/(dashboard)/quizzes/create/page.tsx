'use client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { useQuizActions } from '@/features/quiz/hooks/useQuizActions'
import { CreateQuizSchema, type CreateQuizInput } from '@/features/quiz/schemas/quiz.schema'
import { ROUTES } from '@/constants/routes'

export default function CreateQuizPage() {
  const router = useRouter()
  const { create } = useQuizActions()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuizInput>({
    resolver: zodResolver(CreateQuizSchema),
  })

  async function onSubmit(data: CreateQuizInput) {
    const quiz = await create.mutateAsync(data)
    router.push(ROUTES.QUIZ_DETAIL(quiz.id))
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Criar novo quiz</h1>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              data-testid="input-quiz-title"
              {...register('title')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: História do Brasil"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Descrição
            </label>
            <textarea
              id="description"
              data-testid="input-quiz-description"
              {...register('description')}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Descrição opcional do quiz"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(ROUTES.QUIZZES)}
              disabled={isSubmitting || create.isPending}
            >
              Cancelar
            </Button>
            <Button
              data-testid="btn-submit-create-quiz"
              type="submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? 'Criando...' : 'Criar Quiz'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
