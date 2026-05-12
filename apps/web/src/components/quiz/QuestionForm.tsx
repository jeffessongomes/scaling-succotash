'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  CreateQuestionSchema,
  type CreateQuestionInput,
} from '@/features/quiz/schemas/question.schema'

interface QuestionFormProps {
  onSubmit: (data: CreateQuestionInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

export function QuestionForm({ onSubmit, onCancel, isSubmitting = false }: QuestionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateQuestionInput>({
    resolver: zodResolver(CreateQuestionSchema),
    defaultValues: { timeLimitSecs: 30, points: 1000 },
  })

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4">
        <label htmlFor="question-text" className="mb-1 block text-sm font-medium text-gray-700">
          Texto da pergunta
        </label>
        <textarea
          id="question-text"
          data-testid="input-question-text"
          {...register('text')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          rows={3}
          placeholder="Ex: Qual é a capital do Brasil?"
        />
        {errors.text && (
          <p className="mt-1 text-xs text-red-600">{errors.text.message}</p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="time-limit" className="mb-1 block text-sm font-medium text-gray-700">
            Tempo limite (seg)
          </label>
          <input
            id="time-limit"
            data-testid="input-question-time-limit"
            type="number"
            {...register('timeLimitSecs')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {errors.timeLimitSecs && (
            <p className="mt-1 text-xs text-red-600">{errors.timeLimitSecs.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="points" className="mb-1 block text-sm font-medium text-gray-700">
            Pontos
          </label>
          <input
            id="points"
            data-testid="input-question-points"
            type="number"
            {...register('points')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {errors.points && (
            <p className="mt-1 text-xs text-red-600">{errors.points.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          data-testid="btn-submit-question"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar pergunta'}
        </Button>
      </div>
    </form>
  )
}
