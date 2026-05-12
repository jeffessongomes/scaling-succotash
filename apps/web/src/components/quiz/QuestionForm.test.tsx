import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, userEvent } from '@/test/test-utils'
import { QuestionForm } from './QuestionForm'

const mockOnSubmit = vi.fn()
const mockOnCancel = vi.fn()

beforeEach(() => {
  mockOnSubmit.mockResolvedValue(undefined)
})

describe('QuestionForm', () => {
  describe('when valid data is submitted', () => {
    it('should call onSubmit with form data', async () => {
      const user = userEvent.setup()
      render(<QuestionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByTestId('input-question-text'), 'Qual é a capital do Brasil?')
      await user.click(screen.getByTestId('btn-submit-question'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'Qual é a capital do Brasil?' }),
          expect.anything(),
        )
      })
    })
  })

  describe('when text is empty', () => {
    it('should show validation error', async () => {
      const user = userEvent.setup()
      render(<QuestionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByTestId('btn-submit-question'))

      expect(await screen.findByText('Texto obrigatório')).toBeInTheDocument()
    })
  })

  describe('when timeLimitSecs is below 5', () => {
    it('should show validation error', async () => {
      const user = userEvent.setup()
      render(<QuestionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByTestId('input-question-text'), 'Pergunta válida')
      await user.clear(screen.getByTestId('input-question-time-limit'))
      await user.type(screen.getByTestId('input-question-time-limit'), '3')
      await user.click(screen.getByTestId('btn-submit-question'))

      expect(await screen.findByText('Mínimo 5 segundos')).toBeInTheDocument()
    })
  })

  describe('when submitting', () => {
    it('should disable the submit button', () => {
      render(<QuestionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} isSubmitting />)
      expect(screen.getByTestId('btn-submit-question')).toBeDisabled()
    })
  })
})
