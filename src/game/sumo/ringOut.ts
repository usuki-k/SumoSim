// Ring-out (ACTION-06A, Tokudawara TOKUDAWARA-01A). Pure TypeScript; must not import Phaser.
// Prototype criterion: a participant is OUT once its center is strictly beyond the allowed boundary
// (exactly on the line is still IN). Body size plays no part.
//
// The allowed boundary is the ring circle, optionally widened by four cardinal Tokudawara: inside a
// window |angle - k*pi/2| <= halfAngle (closed) the allowed radius is radius + depth. Without
// Tokudawara the original circle helpers below are used unchanged.
//
// First-out order within one tick uses the resolved-state interpolation model: between two resolved
// Simulation states a center is taken to move in a straight line from its previous resolved position
// to its current one. Internal solver steps (contact correction, bond, grip attach, Counter relocation)
// are not separate ring-out events. Outside depth never decides the winner.
import type { ArenaSetup, BoutOutcome, ParticipantId, Vec2 } from './BoutTypes.ts'

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

// Outcome of one resolved tick for exactly two participants on a plain circle (see resolveArenaRingOut).
export function resolveRingOut(entries: readonly [RingOutEntry, RingOutEntry], arenaRadius: number): BoutOutcome {
  return resolveArenaRingOut(entries, { radius: arenaRadius })
}

// Tokudawara window test for a direction from the ring center: fold into the first octant (|x|, |y|
// and the swap are exact, so all four windows and both sides behave identically) and compare against
// the window side ray. The side boundary itself belongs to the window.
function inTokudawaraWindow(p: Vec2, tanHalfAngle: number): boolean {
  const ax = Math.abs(p.x)
  const ay = Math.abs(p.y)
  return Math.min(ax, ay) <= Math.max(ax, ay) * tanHalfAngle
}

// The canonical allowed radius in the direction of `p`: radius + depth inside a Tokudawara window,
// radius elsewhere. Also usable by presentation to draw the exact boundary.
export function allowedArenaRadius(p: Vec2, arena: ArenaSetup): number {
  const t = arena.tokudawara
  if (!t) return arena.radius
  return inTokudawaraWindow(p, Math.tan(t.halfAngle)) ? arena.radius + t.depth : arena.radius
}

// The single point classifier for an arena (circle: identical to isOutOfRing).
export function isOutOfArena(position: Vec2, arena: ArenaSetup): boolean {
  if (!arena.tokudawara) return isOutOfRing(position, arena.radius)
  return Math.hypot(position.x, position.y) > allowedArenaRadius(position, arena)
}

// Roots in (0, 1) of |p0 + t*d| = radius (cancellation-free form).
function circleCrossings(p0: Vec2, d: Vec2, radius: number, out: number[]): void {
  const a = d.x * d.x + d.y * d.y
  const b = 2 * (p0.x * d.x + p0.y * d.y)
  const c = p0.x * p0.x + p0.y * p0.y - radius * radius
  const disc = b * b - 4 * a * c
  if (!(a > 0) || disc < 0) return
  const q = -(b + (b >= 0 ? 1 : -1) * Math.sqrt(disc)) / 2
  for (const t of [q / a, q === 0 ? NaN : c / q]) if (t > 0 && t < 1) out.push(t)
}

// Parameters in (0, 1) where p0 + t*d meets the line through the origin with direction (ex, ey).
function lineCrossing(p0: Vec2, d: Vec2, ex: number, ey: number, out: number[]): void {
  const denom = d.x * ey - d.y * ex
  if (denom === 0) return
  const t = -(p0.x * ey - p0.y * ex) / denom
  if (t > 0 && t < 1) out.push(t)
}

// Earliest IN -> OUT transition along the straight move previous -> current, as a fraction t in [0, 1)
// of the tick; null when the center never leaves the allowed region during the move. A previous center
// already OUT (should not occur while the bout is ongoing) returns 0.
//
// Circle arenas use firstRingBoundaryCrossingFraction unchanged (the disc is convex, so its last-IN
// root is the only exit). With Tokudawara the region is not convex and the move may leave and re-enter
// within one tick: the boundary can only change between consecutive crossings with the two circles
// (radius, radius + depth) and the four window side lines, so each open interval between those
// parameters is classified at its midpoint with isOutOfArena and the start of the first OUT interval
// is returned. No sampling and no tolerance: identical parameters only produce empty intervals.
export function firstArenaExitFraction(previous: Vec2, current: Vec2, arena: ArenaSetup): number | null {
  const t = arena.tokudawara
  if (!t) return firstRingBoundaryCrossingFraction(previous, current, arena.radius)
  if (isOutOfArena(previous, arena)) return 0
  const d: Vec2 = { x: current.x - previous.x, y: current.y - previous.y }
  const params: number[] = [0, 1]
  circleCrossings(previous, d, arena.radius, params)
  circleCrossings(previous, d, arena.radius + t.depth, params)
  const c = Math.cos(t.halfAngle)
  const s = Math.sin(t.halfAngle)
  // Each line through the origin carries two side rays (e.g. +halfAngle of +x and of -x).
  for (const [ex, ey] of [[c, s], [c, -s], [s, c], [-s, c]]) lineCrossing(previous, d, ex, ey, params)
  params.sort((x, y) => x - y)
  for (let i = 0; i + 1 < params.length; i++) {
    const t0 = params[i]
    const t1 = params[i + 1]
    if (!(t1 > t0)) continue
    const mid = (t0 + t1) / 2
    if (isOutOfArena({ x: previous.x + mid * d.x, y: previous.y + mid * d.y }, arena)) return t0
  }
  // Defensive: an OUT end point whose final interval rounded away still exits within this tick.
  return isOutOfArena(current, arena) ? 1 - Number.EPSILON : null
}

// Outcome of one resolved tick for exactly two participants: nobody leaves -> ongoing; one leaves -> it
// loses; both leave -> the earlier exit loses, (effectively) equal exits -> rematch.
export function resolveArenaRingOut(entries: readonly [RingOutEntry, RingOutEntry], arena: ArenaSetup): BoutOutcome {
  const [a, b] = entries
  const ta = firstArenaExitFraction(a.previous, a.current, arena)
  const tb = firstArenaExitFraction(b.previous, b.current, arena)
  if (ta === null && tb === null) return { kind: 'ongoing' }
  if (ta !== null && tb !== null && Math.abs(ta - tb) <= RING_OUT_SIMULTANEOUS_EPSILON) {
    return { kind: 'rematch', reason: 'simultaneous-ring-out' }
  }
  const aLoses = tb === null || (ta !== null && ta < tb)
  return aLoses
    ? { kind: 'win', winnerId: b.id, loserId: a.id, reason: 'ring-out' }
    : { kind: 'win', winnerId: a.id, loserId: b.id, reason: 'ring-out' }
}
