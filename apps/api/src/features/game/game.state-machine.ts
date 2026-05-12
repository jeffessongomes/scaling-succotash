import type { SessionStatus } from './game.types.js'

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SessionStatus,
    public readonly to: SessionStatus,
  ) {
    super(`Invalid state transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
    Object.setPrototypeOf(this, InvalidTransitionError.prototype)
  }
}

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  LOBBY:       ['ACTIVE', 'FINISHED'],
  ACTIVE:      ['QUESTION', 'FINISHED'],
  QUESTION:    ['REVEAL', 'FINISHED'],
  REVEAL:      ['LEADERBOARD', 'FINISHED'],
  LEADERBOARD: ['QUESTION', 'FINISHED'],
  FINISHED:    [],
}

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to)
  }
}
