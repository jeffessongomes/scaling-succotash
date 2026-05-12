'use client'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CreateOptionSchema,
  OPTION_COLORS,
  type CreateOptionInput,
  type OptionColor,
} from '@/features/quiz/schemas/option.schema'

const COLOR_STYLES: Record<OptionColor, string> = {
  RED: 'bg-red-500 text-white',
  BLUE: 'bg-blue-500 text-white',
  YELLOW: 'bg-yellow-400 text-gray-900',
  GREEN: 'bg-green-500 text-white',
}

const COLOR_LABELS: Record<OptionColor, string> = {
  RED: 'Vermelho',
  BLUE: 'Azul',
  YELLOW: 'Amarelo',
  GREEN: 'Verde',
}

interface AnswerOptionFormProps {
  onSubmit: (data: CreateOptionInput) => Promise<void>
  onCancel: () => void
  existingCorrect?: boolean
  isSubmitting?: boolean
}

export function AnswerOptionForm({
  onSubmit,
  onCancel,
  existingCorrect = false,
  isSubmitting = false,
}: AnswerOptionFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateOptionInput>({
    resolver: zodResolver(CreateOptionSchema),
    defaultValues: { isCorrect: false, color: 'RED' },
  })

  const selectedColor = useWatch({ control, name: 'color' }) as OptionColor | undefined

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <div className="mb-3">
        <input
          data-testid="input-option-text"
          {...register('text')}
          placeholder="Texto da opção"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {errors.text && (
          <p className="mt-1 text-xs text-red-600">{errors.text.message}</p>
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1 text-xs font-medium text-gray-600">Cor</p>
        <div className="flex gap-2">
          {OPTION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              data-testid={`btn-color-${color.toLowerCase()}`}
              onClick={() => setValue('color', color)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-medium transition-all ring-2',
                COLOR_STYLES[color],
                selectedColor === color ? 'ring-gray-900 scale-105' : 'ring-transparent',
              )}
            >
              {COLOR_LABELS[color]}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('color')} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          id="is-correct"
          data-testid="chk-toggle-correct"
          type="checkbox"
          disabled={existingCorrect}
          {...register('isCorrect')}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="is-correct" className="text-sm text-gray-700">
          Resposta correta
          {existingCorrect && (
            <span className="ml-1 text-xs text-gray-400">(já existe uma correta)</span>
          )}
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          data-testid="btn-submit-option"
          type="submit"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Salvando...' : 'Salvar opção'}
        </Button>
      </div>
    </form>
  )
}
