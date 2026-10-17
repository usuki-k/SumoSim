// Canonical owner of bout runtime state. Pure TypeScript; must not import Phaser.
import type {
  ArenaSetup,
  BoutSetup,
  BoutSnapshot,
  ParticipantId,
  ParticipantIntent,
  ParticipantState,
  Vec2,
} from './BoutTypes.ts'

// Provisional technical values for the movement foundation; NOT final balance. Subject to User Play Test.
export const SIMULATION_HZ = 60
export const TICK_SECONDS = 1 / SIMULATION_HZ
export const MAX_SPEED = 3 // m/s
export const ACCELERATION = 12 // m/s^2, while the move intent is non-zero
export const DECELERATION = 15 // m/s^2, while the move intent is zero

interface MutableParticipant {
  id: string
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  facing: number
}

function assertFiniteVec2(v: Vec2, label: string): void {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    throw new Error(`Invalid BoutSetup: ${label} must be finite`)
  }
}

// Non-finite input is treated as no input; length is clamped to at most 1.
function sanitizeMove(move: Vec2): { x: number; y: number } {
  if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) return { x: 0, y: 0 }
  const length = Math.hypot(move.x, move.y)
  if (length > 1) return { x: move.x / length, y: move.y / length }
  return { x: move.x, y: move.y }
}

// Direction from `from` toward `to`, or `fallback` when the points coincide.
function facingToward(from: Vec2, to: Vec2, fallback: number): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  return Math.atan2(dy, dx)
}

export class BoutSimulation {
  private readonly arena: ArenaSetup
  private readonly participants: MutableParticipant[]

  constructor(setup: BoutSetup) {
    if (!Number.isFinite(setup.arena.radius) || setup.arena.radius <= 0) {
      throw new Error('Invalid BoutSetup: arena.radius must be a positive finite number')
    }
    if (setup.participants.length !== 2) {
      throw new Error('Invalid BoutSetup: exactly 2 participants are required')
    }
    const ids = new Set<string>()
    for (const p of setup.participants) {
      if (p.id === '') throw new Error('Invalid BoutSetup: participant id must not be empty')
      if (ids.has(p.id)) throw new Error(`Invalid BoutSetup: duplicate participant id "${p.id}"`)
      ids.add(p.id)
      assertFiniteVec2(p.position, `participant "${p.id}" position`)
    }

    // Copy so the caller setup object is never aliased as canonical state.
    this.arena = { radius: setup.arena.radius }
    this.participants = setup.participants.map((p) => ({
      id: p.id,
      position: { x: p.position.x, y: p.position.y },
      velocity: { x: 0, y: 0 },
      facing: 0,
    }))
    this.updateFacing()
  }

  // Advances exactly one logical tick (TICK_SECONDS). Participants without an intent have zero move.
  step(intents: ReadonlyMap<ParticipantId, ParticipantIntent>): void {
    for (const p of this.participants) {
      const move = sanitizeMove(intents.get(p.id)?.move ?? { x: 0, y: 0 })
      const hasInput = move.x !== 0 || move.y !== 0
      const targetX = move.x * MAX_SPEED
      const targetY = move.y * MAX_SPEED

      // Velocity follows the target velocity at a bounded rate (never overshoots).
      const maxDelta = (hasInput ? ACCELERATION : DECELERATION) * TICK_SECONDS
      const dx = targetX - p.velocity.x
      const dy = targetY - p.velocity.y
      const distance = Math.hypot(dx, dy)
      if (distance <= maxDelta) {
        p.velocity.x = targetX
        p.velocity.y = targetY
      } else {
        p.velocity.x += (dx / distance) * maxDelta
        p.velocity.y += (dy / distance) * maxDelta
      }

      p.position.x += p.velocity.x * TICK_SECONDS
      p.position.y += p.velocity.y * TICK_SECONDS
    }
    this.updateFacing()
  }

  // Returns a fresh copy; mutating it never affects canonical state.
  getSnapshot(): BoutSnapshot {
    return {
      arena: { radius: this.arena.radius },
      participants: this.participants.map(
        (p): ParticipantState => ({
          id: p.id,
          position: { x: p.position.x, y: p.position.y },
          velocity: { x: p.velocity.x, y: p.velocity.y },
          facing: p.facing,
        }),
      ),
    }
  }

  // Each participant faces the other; keeps the previous facing if positions coincide.
  private updateFacing(): void {
    const [a, b] = this.participants
    a.facing = facingToward(a.position, b.position, a.facing)
    b.facing = facingToward(b.position, a.position, b.facing)
  }
}
