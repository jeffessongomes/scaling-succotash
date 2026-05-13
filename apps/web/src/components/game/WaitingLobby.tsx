'use client'
import { Button } from '@/components/ui/button'
import { QRCodeDisplay } from '@/components/shared/QRCodeDisplay'
import { GAME_CONSTANTS } from '@/constants/game'
import type { GameSession, GamePlayer } from '@/features/game/types'

interface WaitingLobbyProps {
  session: GameSession
  players: GamePlayer[]
  onStart: () => void
  appUrl: string
}

export function WaitingLobby({ session, players, onStart, appUrl }: WaitingLobbyProps) {
  const joinUrl = `${appUrl}/game/join?pin=${session.pin}`
  const formattedPin = `${session.pin.slice(0, 3)} ${session.pin.slice(3)}`
  const canStart = players.length > 0

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            PIN da sessão
          </p>
          <p
            data-testid="text-session-pin"
            className="text-6xl font-black tracking-widest text-gray-900"
          >
            {formattedPin}
          </p>
          <p className="text-xs text-gray-400">{appUrl}/game/join</p>
        </div>

        <QRCodeDisplay value={joinUrl} size={160} />
      </div>

      <div className="w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Jogadores (
            <span data-testid="text-player-count">{players.length}</span>
            /{GAME_CONSTANTS.MAX_PLAYERS})
          </p>
        </div>

        {players.length === 0 ? (
          <p
            data-testid="text-waiting-players"
            className="text-center text-sm text-gray-400"
          >
            Aguardando jogadores…
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {players.map((player) => (
              <div
                key={player.nickname}
                className="flex flex-col items-center gap-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-2xl">
                  {player.avatarId}
                </div>
                <span
                  data-testid={`text-player-nickname-${player.nickname}`}
                  className="max-w-[60px] truncate text-xs text-gray-600"
                >
                  {player.nickname}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        data-testid="btn-start-game"
        size="lg"
        disabled={!canStart}
        onClick={onStart}
        className="px-12"
      >
        Iniciar Partida ▶
      </Button>

      {!canStart && (
        <p className="text-xs text-gray-400">
          Aguarde ao menos 1 jogador para iniciar
        </p>
      )}
    </div>
  )
}
