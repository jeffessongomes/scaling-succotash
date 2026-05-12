import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from './test-utils'

describe('test-utils', () => {
  it('should render children inside providers without error', () => {
    render(<div>Olá do Azimute</div>)
    expect(screen.getByText('Olá do Azimute')).toBeInTheDocument()
  })

  it('should expose userEvent configured with default options', async () => {
    const handleClick = vi.fn()
    render(
      <button data-testid="btn-test-click" onClick={handleClick}>
        Clique aqui
      </button>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByTestId('btn-test-click'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should isolate query client between tests', () => {
    const { unmount } = render(<div>Teste 1</div>)
    unmount()
    render(<div>Teste 2</div>)
    expect(screen.getByText('Teste 2')).toBeInTheDocument()
  })
})
