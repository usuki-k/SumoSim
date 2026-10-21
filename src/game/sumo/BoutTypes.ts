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

// Four identical Tokudawara on the cardinal axes (+x, +y, -x, -y). Inside a window
// |angle - k*pi/2| <= halfAngle the ring-out boundary lies `depth` meters further out.
export interface TokudawaraSetup {
  readonly depth: number // meters, > 0
  readonly halfAngle: number // radians, 0 < halfAngle < pi/4
}

// Ring is a circle centered on the simulation origin (0, 0). Radius in meters.
// Without `tokudawara` the boundary is the plain circle.
export interface ArenaSetup {
  readonly radius: number
  readonly tokudawara?: TokudawaraSetup
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
  // A new Counter press edge for this tick. If pushPressed is also true, Push wins and this is dropped.
  readonly counterPressed: boolean
  // A new Grip press edge for this tick: starts a Grip while free, releases while grappled.
  // Lowest same-tick priority (Push > Counter > Grip).
  readonly gripPressed: boolean
  // Held Drive effort (the same key as Push, as a held state). Used only while grappled and READY;
  // ignored while free (where the Push edge applies instead).
  readonly driveHeld: boolean
}

export type PushPhase = 'startup' | 'active' | 'recovery'
export type GripPhase = 'reach' | 'recovery'

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
  | {
      readonly kind: 'counter'
      // Counter window ticks left, including the next tick (always >= 1).
      readonly ticksRemaining: number
    }
  | {
      readonly kind: 'grip'
      readonly phase: GripPhase
      // Ticks left in the current phase, including the next tick (always >= 1).
      readonly ticksRemaining: number
    }
  // Grappled only: actually contributing Drive this tick (timerless; re-decided every tick).
  | { readonly kind: 'drive' }

// Best / Success are decided when a Counter catches an active Push; Fail is a window that expired.
export type CounterTier = 'best' | 'success' | 'fail'

// Physical stability, separate from the chosen action. While in kuzushi the action is always idle.
export type ParticipantPosture =
  | { readonly kind: 'stable' }
  | {
      readonly kind: 'kuzushi'
      // Full Kuzushi ticks still to come (0 = recovers at the start of the next tick).
      readonly ticksRemaining: number
    }

export interface ParticipantState {
  readonly id: ParticipantId
  readonly position: Vec2
  // Actual total velocity (own footwork + externally induced momentum).
  readonly velocity: Vec2
  // The externally induced part of `velocity` (Push momentum received); own footwork = velocity - this.
  readonly externalVelocity: Vec2
  readonly action: ParticipantActionState
  readonly posture: ParticipantPosture
  readonly facing: number
  // Gameplay contact radius in meters (simulation-owned; presentation reads it from the snapshot).
  readonly bodyRadius: number
}

export type GrappleAdvantage =
  | { readonly kind: 'neutral' }
  // Exactly one participant holds Morozashi (both arms inside); the other is at a disadvantage.
  | { readonly kind: 'morozashi'; readonly holderId: ParticipantId }

// Pair-level relationship: the single source of truth for "are these two grappled, and how".
export type BoutEngagement =
  | { readonly kind: 'free' }
  | { readonly kind: 'grappled'; readonly advantage: GrappleAdvantage }

// Why a bout was decided. A union so future finishes can be added without changing the shape.
export type BoutFinishReason = 'ring-out'
export type BoutRematchReason = 'simultaneous-ring-out'

// Simulation-owned result of the bout; presentation text (sides / names) is formatted elsewhere.
export type BoutOutcome =
  | { readonly kind: 'ongoing' }
  | {
      readonly kind: 'win'
      readonly winnerId: ParticipantId
      readonly loserId: ParticipantId
      readonly reason: BoutFinishReason
    }
  | { readonly kind: 'rematch'; readonly reason: BoutRematchReason }

// Pair-level Counter resolution (ACTION-04A4): after a Best / Success catch both participants follow a
// Simulation-owned path for a fixed number of ticks with all input ignored. The path itself is internal;
// canonical positions / facing already carry what presentation needs.
export type BoutCounterTransition =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'active'
      readonly tier: Exclude<CounterTier, 'fail'>
      // The participant whose Counter caught the Push.
      readonly counterUserId: ParticipantId
      // The participant whose active Push was caught.
      readonly pusherId: ParticipantId
      // Transition ticks still to run, including the next tick (0 only when the bout was decided on
      // the final transition tick).
      readonly ticksRemaining: number
    }

export interface BoutSnapshot {
  readonly arena: ArenaSetup
  readonly participants: readonly ParticipantState[]
  readonly engagement: BoutEngagement
  readonly counterTransition: BoutCounterTransition
  readonly outcome: BoutOutcome
}
