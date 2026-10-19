// Ring-out (ACTION-06A). Pure TypeScript; must not import Phaser.
// Prototype criterion: a participant is OUT once its center is strictly beyond the ring radius
// (exactly on the line is still IN). Body size plays no part.
//
// First-out order within one tick uses the resolved-state interpolation model: between two resolved
// Simulation states a center is taken to move in a straight line from its previous resolved position
// to its current one. Internal solver steps (contact correction, bond, grip attach, Counter relocation)
// are not separate ring-out events. Outside depth never decides the winner.
import type { BoutOutcome, ParticipantId, Vec2 } from './BoutTypes.ts'

// Technical (not gameplay): crossing fractions (of one tick) this close count as simultaneous.
export const RING_OUT_SIMULTANEOUS_EPSILON = 1e-9

export function isOutOfRing(position: Vec2, arenaRadius: number): boolean {
  return Math.hypot(position.x, position.y) > arenaRadius
}

// When the current center is OUT: the fraction t in [0, 1) of the straight move previous -> current
// at which the center was last IN (on the line), i.e. the upper root of |previous + t*d| = radius.
// null when the current center is IN. A previous center already OUT (should not occur while the bout
// is ongoing) returns 0.
export function firstRingBoundaryCrossingFraction(previous: Vec2, current: Vec2, arenaRadius: number): number | null {
  if (!isOutOfRing(current, arenaRadius)) return null
  if (isOutOfRing(previous, arenaRadius)) return 0
  const dx = current.x - previous.x
  const dy = current.y - previous.y
  const a = dx * dx + dy * dy
  const b = 2 * (previous.x * dx + previous.y * dy)
  const c = previous.x * previous.x + previous.y * previous.y - arenaRadius * arenaRadius // <= 0
  const root = Math.sqrt(Math.max(0, b * b - 4 * a * c))
  // Cancellation-free form of the larger root.
  let t: number
  if (b >= 0) {
    const q = -(b + root) / 2
    t = q === 0 ? 0 : c / q
  } else {
    t = (-b + root) / (2 * a)
  }
  if (!(t > 0)) return 0 // also maps -0 / NaN to 0
  return t < 1 ? t : 1 - Number.EPSILON
}

export interface RingOutEntry {
  readonly id: ParticipantId
  readonly previous: Vec2
  readonly current: Vec2
}

// Outcome of one resolved tick for exactly two participants: nobody OUT -> ongoing; one OUT -> it
// loses; both OUT -> the earlier crossing loses, (effectively) equal crossings -> rematch.
export function resolveRingOut(entries: readonly [RingOutEntry, RingOutEntry], arenaRadius: number): BoutOutcome {
  const [a, b] = entries
  const ta = firstRingBoundaryCrossingFraction(a.previous, a.current, arenaRadius)
  const tb = firstRingBoundaryCrossingFraction(b.previous, b.current, arenaRadius)
  if (ta === null && tb === null) return { kind: 'ongoing' }
  if (ta !== null && tb !== null && Math.abs(ta - tb) <= RING_OUT_SIMULTANEOUS_EPSILON) {
    return { kind: 'rematch', reason: 'simultaneous-ring-out' }
  }
  const aLoses = tb === null || (ta !== null && ta < tb)
  return aLoses
    ? { kind: 'win', winnerId: b.id, loserId: a.id, reason: 'ring-out' }
    : { kind: 'win', winnerId: a.id, loserId: b.id, reason: 'ring-out' }
}
