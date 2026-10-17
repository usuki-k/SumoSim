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
  // A new Push press edge for this tick (one press = one Push), not the held key state.
  readonly pushPressed: boolean
}

export type PushPhase = 'startup' | 'active' | 'recovery'

export type ParticipantActionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'push'
      readonly phase: PushPhase
      // Ticks left in the current phase, including the next tick (always >= 1).
      readonly ticksRemaining: number
      // Unit drive direction locked when the Push began.
      readonly direction: Vec2
    }

export interface ParticipantState {
  readonly id: ParticipantId
  readonly position: Vec2
  // Actual total velocity (own footwork + externally induced momentum).
  readonly velocity: Vec2
  // The externally induced part of `velocity` (Push momentum received); own footwork = velocity - this.
  readonly externalVelocity: Vec2
  readonly action: ParticipantActionState
  readonly facing: number
  // Gameplay contact radius in meters (simulation-owned; presentation reads it from the snapshot).
  readonly bodyRadius: number
}

export interface BoutSnapshot {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantState[]
}
