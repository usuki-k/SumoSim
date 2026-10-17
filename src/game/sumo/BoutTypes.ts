// Pure TypeScript bout types. Must not import Phaser.

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export type ParticipantId = string

export interface ParticipantSetup {
  readonly id: ParticipantId
  readonly position: Vec2
}

// Ring is a circle centered on the simulation origin (0, 0).
export interface ArenaSetup {
  readonly radius: number
}

// Explicit input boundary. Future management state is converted into this shape by the caller.
export interface BoutSetup {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantSetup[]
}

export interface ParticipantState {
  readonly id: ParticipantId
  readonly position: Vec2
}

export interface BoutSnapshot {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantState[]
}
