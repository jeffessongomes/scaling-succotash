import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { WaitingLobby } from '../WaitingLobby'
import type { GamePlayer, GameSession } from '@/features/game/types'
import type { GamePhase } from '@/types'

vi.mock('@/components/shared/QRCodeDisplay', () => ({
  QRCodeDisplay: ({ value }: { value: string }) => (
    <div data-testid="img-qrcode-session" data-value={value} />
  ),
}))

const createGameSession = (overrides?: Partial<GameSession>): GameSession => ({
  pin: '482915',
  quizId: 'quiz-abc-123',
  quizTitle: 'Capitais do Mundo',
  totalQuestions: 7,
  status: 'lobby' as GamePhase,
  ...overrides,
})

const createGamePlayer = (overrides?: Partial<GamePlayer>): GamePlayer => ({
  nickname: 'Ana Silva',
  avatarId: 'avatar-cat',
  ...overrides,
})

const defaultProps = {
  session: createGameSession(),
  players: [] as GamePlayer[],
  onStart: vi.fn(),
  appUrl: 'http://localhost:3000',
}

describe('WaitingLobby', () => {
  it('should render the session PIN prominently', () => {
    render(<WaitingLobby {...defaultProps} />)
    expect(screen.getByTestId('text-session-pin')).toHaveTextContent('482 915')
  })

  it('should render QR Code with correct join URL', () => {
    render(<WaitingLobby {...defaultProps} />)
    const qr = screen.getByTestId('img-qrcode-session')
    expect(qr).toHaveAttribute('data-value', 'http://localhost:3000/game/join?pin=482915')
  })

  it('should show "Aguardando jogadores…" when player list is empty', () => {
    render(<WaitingLobby {...defaultProps} players={[]} />)
    expect(screen.getByTestId('text-waiting-players')).toBeInTheDocument()
  })

  it('should disable start button when there are no players', () => {
    render(<WaitingLobby {...defaultProps} players={[]} />)
    expect(screen.getByTestId('btn-start-game')).toBeDisabled()
  })

  it('should enable start button when there is at least one player', () => {
    render(<WaitingLobby {...defaultProps} players={[createGamePlayer()]} />)
    expect(screen.getByTestId('btn-start-game')).not.toBeDisabled()
  })

  it('should display player nickname in the list', () => {
    const players = [
      createGamePlayer({ nickname: 'Ana Silva', avatarId: 'avatar-cat' }),
      createGamePlayer({ nickname: 'João Costa', avatarId: 'avatar-dog' }),
    ]
    render(<WaitingLobby {...defaultProps} players={players} />)
    expect(screen.getByTestId('text-player-nickname-Ana Silva')).toBeInTheDocument()
    expect(screen.getByTestId('text-player-nickname-João Costa')).toBeInTheDocument()
  })

  it('should show player count in header', () => {
    const players = [createGamePlayer(), createGamePlayer({ nickname: 'João Costa', avatarId: 'avatar-dog' })]
    render(<WaitingLobby {...defaultProps} players={players} />)
    expect(screen.getByTestId('text-player-count')).toHaveTextContent('2')
  })

  it('should call onStart when start button is clicked', async () => {
    const onStart = vi.fn()
    render(<WaitingLobby {...defaultProps} players={[createGamePlayer()]} onStart={onStart} />)
    screen.getByTestId('btn-start-game').click()
    expect(onStart).toHaveBeenCalledOnce()
  })
})
