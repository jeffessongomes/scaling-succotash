import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, userEvent } from '@/test/test-utils'
import { AnswerOptionForm } from './AnswerOptionForm'

const mockOnSubmit = vi.fn()
const mockOnCancel = vi.fn()

beforeEach(() => {
  mockOnSubmit.mockResolvedValue(undefined)
})

describe('AnswerOptionForm', () => {
  describe('when color is selected', () => {
    it('should highlight the selected color button', async () => {
      const user = userEvent.setup()
      render(<AnswerOptionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.click(screen.getByTestId('btn-color-blue'))

      expect(screen.getByTestId('btn-color-blue').className).toMatch(/scale-105/)
    })
  })

  describe('when valid data is submitted', () => {
    it('should call onSubmit with form data', async () => {
      const user = userEvent.setup()
      render(<AnswerOptionForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      await user.type(screen.getByTestId('input-option-text'), 'Brasília')
      await user.click(screen.getByTestId('btn-color-blue'))
      await user.click(screen.getByTestId('chk-toggle-correct'))
      await user.click(screen.getByTestId('btn-submit-option'))

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            text: 'Brasília',
            color: 'BLUE',
            isCorrect: true,
          }),
          expect.anything(),
        )
      })
    })
  })

  describe('when one option is marked correct', () => {
    it('should show warning that existing correct option will be replaced', async () => {
      const user = userEvent.setup()
      render(
        <AnswerOptionForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          existingCorrectOptionId="opt-existing"
        />,
      )

      await user.click(screen.getByTestId('chk-toggle-correct'))

      expect(await screen.findByTestId('text-replace-correct-warning')).toBeInTheDocument()
    })
  })
})
