'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { QuestionForm } from '@/components/quiz/QuestionForm'
import { AnswerOptionForm } from '@/components/quiz/AnswerOptionForm'
import { useQuizDetail } from '@/features/quiz/hooks/useQuizDetail'
import { useQuizActions } from '@/features/quiz/hooks/useQuizActions'
import { useQuizEditor } from '@/features/quiz/hooks/useQuizEditor'
import { ROUTES } from '@/constants/routes'
import type { QuestionPublic } from '@/features/quiz/types'
import type { CreateQuestionInput } from '@/features/quiz/schemas/question.schema'
import type { CreateOptionInput } from '@/features/quiz/schemas/option.schema'

const OPTION_COLOR_STYLES = {
  RED: 'bg-red-500',
  BLUE: 'bg-blue-500',
  YELLOW: 'bg-yellow-400',
  GREEN: 'bg-green-500',
} as const

function SortableQuestion({
  question,
  onDelete,
  onAddOption,
  showDragHandle,
}: {
  question: QuestionPublic
  onDelete: () => void
  onAddOption: (questionId: string) => void
  showDragHandle: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: question.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const hasCorrect = question.options.some((o) => o.isCorrect)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-start gap-3 p-4">
        {showDragHandle && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab text-gray-400 active:cursor-grabbing"
            aria-label="Arrastar pergunta"
          >
            ⠿
          </button>
        )}

        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{question.text}</p>
          <div className="mt-1 flex gap-3 text-xs text-gray-500">
            <span>{question.timeLimitSecs}s</span>
            <span>{question.points} pts</span>
          </div>

          <div className="mt-3 space-y-1.5">
            {question.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-sm ${OPTION_COLOR_STYLES[opt.color]}`}
                />
                <span className={`text-sm ${opt.isCorrect ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {opt.text}
                  {opt.isCorrect && <span className="ml-1 text-green-600">✓</span>}
                </span>
              </div>
            ))}
          </div>

          {question.options.length < 4 && (
            <Button
              data-testid={`btn-add-option-${question.id}`}
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => onAddOption(question.id)}
            >
              + Adicionar opção
            </Button>
          )}
        </div>

        <Button
          data-testid={`btn-delete-question-${question.id}`}
          variant="destructive"
          size="sm"
          onClick={onDelete}
        >
          Remover
        </Button>
      </div>

      {!hasCorrect && question.options.length > 0 && (
        <div className="border-t border-yellow-200 bg-yellow-50 px-4 py-2">
          <p className="text-xs text-yellow-700">Nenhuma opção marcada como correta</p>
        </div>
      )}
    </div>
  )
}

export default function QuizEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: quiz, isLoading, error } = useQuizDetail(id)
  const { publish } = useQuizActions()
  const editor = useQuizEditor(id)

  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-xl bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-200" />
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">Erro ao carregar o quiz.</p>
      </div>
    )
  }

  const questions = [...quiz.questions].sort((a, b) => a.order - b.order)
  const canPublish = questions.length > 0

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = questions.findIndex((q) => q.id === active.id)
    const newIndex = questions.findIndex((q) => q.id === over.id)
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
      ...q,
      order: i + 1,
    }))

    editor.reorderQuestions(questions, reordered)
  }

  async function handleAddQuestion(data: CreateQuestionInput) {
    await editor.addQuestion.mutateAsync(data)
    setShowQuestionForm(false)
  }

  async function handleAddOption(questionId: string, data: CreateOptionInput) {
    if (data.isCorrect) {
      const existingCorrectOpt = questions
        .find((q) => q.id === questionId)
        ?.options.find((o) => o.isCorrect)
      if (existingCorrectOpt) {
        await editor.editOption.mutateAsync({ id: existingCorrectOpt.id, body: { isCorrect: false } })
      }
    }
    await editor.addOption.mutateAsync({ questionId, body: data })
    setAddingOptionFor(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            data-testid="btn-back-to-quizzes"
            href={ROUTES.QUIZZES}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Meus Quizzes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
          <span
            data-testid="badge-quiz-status"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              quiz.isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {quiz.isPublished ? 'Publicado' : 'Rascunho'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!canPublish && (
            <span className="text-xs text-gray-400">Adicione ao menos 1 pergunta para publicar</span>
          )}
          <Button
            data-testid="btn-publish-quiz"
            variant={quiz.isPublished ? 'outline' : 'default'}
            disabled={!canPublish || publish.isPending}
            onClick={() => publish.mutate({ id: quiz.id, isPublished: !quiz.isPublished })}
          >
            {quiz.isPublished ? 'Despublicar' : 'Publicar'}
          </Button>
        </div>
      </div>

      {editor.reorderError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {editor.reorderError}
        </div>
      )}

      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            {questions.map((question) => (
              <SortableQuestion
                key={question.id}
                question={question}
                showDragHandle={questions.length > 1}
                onDelete={() => editor.removeQuestion.mutate(question.id)}
                onAddOption={(questionId) => setAddingOptionFor(questionId)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {addingOptionFor && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-medium text-gray-700">Nova opção de resposta</p>
            <AnswerOptionForm
              existingCorrectOptionId={
                questions
                  .find((q) => q.id === addingOptionFor)
                  ?.options.find((o) => o.isCorrect)?.id
              }
              onSubmit={(data) => handleAddOption(addingOptionFor, data)}
              onCancel={() => setAddingOptionFor(null)}
              isSubmitting={editor.addOption.isPending}
            />
          </div>
        )}

        {showQuestionForm ? (
          <QuestionForm
            onSubmit={handleAddQuestion}
            onCancel={() => setShowQuestionForm(false)}
            isSubmitting={editor.addQuestion.isPending}
          />
        ) : (
          <Button
            data-testid="btn-add-question"
            variant="outline"
            className="w-full"
            onClick={() => setShowQuestionForm(true)}
          >
            + Adicionar Pergunta
          </Button>
        )}
      </div>
    </div>
  )
}
