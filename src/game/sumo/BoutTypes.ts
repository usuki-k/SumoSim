// Pure TypeScript bout types. Must not import Phaser.
//
// Units: position in meters, velocity in meters/second, facing in radians.
// Coordinate convention: origin = ring center, +x right, +y down (same orientation as the canvas),
// facing 0 = +x, angles from Math.atan2(dy, dx).

export interface Vec2 {
  readonly x: number
  readonly y: number
}

export type ParticipantId = string

export interface ParticipantSetup {
  readonly id: ParticipantId
  readonly position: Vec2
}

// Ring is a circle centered on the simulation origin (0, 0). Radius in meters.
export interface ArenaSetup {
  readonly radius: number
}

// Explicit input boundary. Future management state is converted into this shape by the caller.
export interface BoutSetup {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantSetup[]
}

// Semantic per-tick input. Source-agnostic (keyboard / touch / CPU); never raw keys.
export interface ParticipantIntent {
  // World-frame movement direction. Length is clamped to at most 1 by the simulation.
  readonly move: Vec2
}

export interface ParticipantState {
  readonly id: ParticipantId
  readonly position: Vec2
  readonly velocity: Vec2
  readonly facing: number
}

export interface BoutSnapshot {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantState[]
}
