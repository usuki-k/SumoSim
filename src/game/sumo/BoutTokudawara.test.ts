import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, PUSH_STARTUP_TICKS } from './BoutSimulation.ts'
import type { ArenaSetup, BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, Vec2 } from './BoutTypes.ts'
import {
  RING_OUT_SIMULTANEOUS_EPSILON,
  allowedArenaRadius,
  firstArenaExitFraction,
  firstRingBoundaryCrossingFraction,
  isOutOfArena,
  isOutOfRing,
  resolveArenaRingOut,
  resolveRingOut,
} from './ringOut.ts'
import ringOutSource from './ringOut.ts?raw'

// Accepted Product geometry (TOKUDAWARA-01A).
const R = 2.275
const D = 0.1194375
const H = Math.PI / 20
const ARENA: ArenaSetup = { radius: R, tokudawara: { depth: D, halfAngle: H } }
const RD = R + D // same expression the classifier uses
const TAN_H = Math.tan(H)

// Exactly representable fixture for exact-boundary checks: 3-4-5 points sit in normal sections.
const EXACT: ArenaSetup = { radius: 5, tokudawara: { depth: 0.25, halfAngle: H } }

const polar = (r: number, a: number): Vec2 => ({ x: Math.cos(a) * r, y: Math.sin(a) * r })
const lerp = (p: Vec2, q: Vec2, t: number): Vec2 => ({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
const radial = (p: Vec2) => Math.hypot(p.x, p.y)

// The four cardinal sections as exact transforms of a +x-section point (quarter turns, no rounding).
const SECTIONS: readonly { name: string; map: (p: Vec2) => Vec2 }[] = [
  { name: '+x', map: (p) => ({ x: p.x, y: p.y }) },
  { name: '+y', map: (p) => ({ x: -p.y, y: p.x }) },
  { name: '-x', map: (p) => ({ x: -p.x, y: -p.y }) },
  { name: '-y', map: (p) => ({ x: p.y, y: -p.x }) },
]
// Both sides of a window: the +halfAngle side as is, the -halfAngle side mirrored (exact).
const SIDES: readonly { name: string; map: (p: Vec2) => Vec2 }[] = [
  { name: 'ccw', map: (p) => ({ x: p.x, y: p.y }) },
  { name: 'cw', map: (p) => ({ x: p.x, y: -p.y }) },
]
const EVERY_SIDE = SECTIONS.flatMap((s) => SIDES.map((side) => ({ name: `${s.name}/${side.name}`, map: (p: Vec2) => s.map(side.map(p)) })))

// A point on the +halfAngle side ray of the +x window, constructed the way the classifier folds it.
const onSide = (along: number): Vec2 => ({ x: along, y: along * TAN_H })

describe('Tokudawara point classifier (TOKUDAWARA-01A)', () => {
  it('cardinal center lines: R < r <= R + depth is IN, beyond R + depth is OUT (all four)', () => {
    for (const s of SECTIONS) {
      for (const r of [R, R + D / 2, RD]) expect(isOutOfArena(s.map({ x: r, y: 0 }), ARENA), `${s.name} r=${r}`).toBe(false)
      expect(isOutOfArena(s.map({ x: RD + 1e-9, y: 0 }), ARENA), s.name).toBe(true)
      expect(isOutOfArena(s.map({ x: RD * (1 + 1e-12), y: 0 }), ARENA), s.name).toBe(true)
      expect(allowedArenaRadius(s.map({ x: 1, y: 0 }), ARENA)).toBe(RD)
    }
    // exactly representable outer boundary
    for (const s of SECTIONS) {
      expect(isOutOfArena(s.map({ x: 5.25, y: 0 }), EXACT)).toBe(false)
      expect(isOutOfArena(s.map({ x: 5.25 + 1e-12, y: 0 }), EXACT)).toBe(true)
    }
  })

  it('normal sections: exactly on R is IN, just beyond is OUT (every octant)', () => {
    for (const [x, y] of [[3, 4], [4, 3], [-3, 4], [-4, 3], [-3, -4], [-4, -3], [3, -4], [4, -3]]) {
      expect(isOutOfArena({ x, y }, EXACT)).toBe(false)
      expect(isOutOfArena({ x: x * (1 + 1e-12), y: y * (1 + 1e-12) }, EXACT)).toBe(true)
      expect(allowedArenaRadius({ x, y }, EXACT)).toBe(5)
    }
    for (const s of SECTIONS) {
      for (const a of [Math.PI / 4, H + 0.01, Math.PI / 2 - H - 0.01, 0.5]) {
        const p = s.map(polar(R * (1 - 1e-9), a))
        const q = s.map(polar(R * (1 + 1e-9), a))
        expect(isOutOfArena(p, ARENA)).toBe(false)
        expect(isOutOfArena(q, ARENA)).toBe(true)
        expect(isOutOfArena(q, ARENA)).toBe(isOutOfRing(q, R))
      }
    }
  })

  it('side boundaries belong to the window; just outside the window beyond R is OUT (all eight sides)', () => {
    for (const side of EVERY_SIDE) {
      for (const r of [R + 1e-6, R + D / 2, RD - 1e-6]) {
        const along = r * Math.cos(H)
        const p = side.map(onSide(along))
        expect(isOutOfArena(p, ARENA), `${side.name} r=${r}`).toBe(false)
        expect(allowedArenaRadius(p, ARENA)).toBe(RD)
        const outside = side.map({ x: along, y: along * TAN_H * (1 + 1e-9) })
        expect(isOutOfArena(outside, ARENA), `${side.name} r=${r} outside`).toBe(true)
        expect(allowedArenaRadius(outside, ARENA)).toBe(R)
      }
      // at or inside R the window does not matter
      const corner = side.map({ x: R * 0.999 * Math.cos(H), y: R * 0.999 * Math.cos(H) * TAN_H * 1.01 })
      expect(isOutOfArena(corner, ARENA)).toBe(false)
    }
  })

  it('the same radius is IN inside a window and OUT outside it', () => {
    for (const s of SECTIONS) {
      expect(isOutOfArena(s.map(polar(R + D / 2, 0)), ARENA)).toBe(false)
      expect(isOutOfArena(s.map(polar(R + D / 2, H * 0.5)), ARENA)).toBe(false)
      expect(isOutOfArena(s.map(polar(R + D / 2, H * 1.2)), ARENA)).toBe(true)
      expect(isOutOfArena(s.map(polar(R + D / 2, Math.PI / 4)), ARENA)).toBe(true)
    }
  })

  it('without Tokudawara the classifier is the circle classifier', () => {
    const circle: ArenaSetup = { radius: R }
    for (let i = 0; i < 64; i++) {
      const p = polar(R * (0.98 + 0.04 * ((i * 37) % 64) / 64), (i * Math.PI) / 32)
      expect(isOutOfArena(p, circle)).toBe(isOutOfRing(p, R))
      expect(allowedArenaRadius(p, circle)).toBe(R)
    }
  })
})

// Parameter where the straight move p0 -> p1 meets the side line through the origin at angle `a`.
function lineParam(p0: Vec2, p1: Vec2, a: number): number {
  const ex = Math.cos(a)
  const ey = Math.sin(a)
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  return -(p0.x * ey - p0.y * ex) / (dx * ey - dy * ex)
}

describe('Tokudawara earliest IN -> OUT crossing (TOKUDAWARA-01A)', () => {
  it('normal circular section IN -> OUT matches the circle root (all four quadrants)', () => {
    for (const s of SECTIONS) {
      for (const a of [Math.PI / 4, 0.4]) {
        const p0 = s.map(polar(R - 0.1, a))
        const p1 = s.map(polar(R + 0.1, a))
        const t = firstArenaExitFraction(p0, p1, ARENA)!
        expect(t).toBeCloseTo(0.5, 12)
        expect(t).toBeCloseTo(firstRingBoundaryCrossingFraction(p0, p1, R)!, 12)
      }
    }
  })

  it('Tokudawara outer arc IN -> OUT (all four sections, center line and off-axis)', () => {
    for (const s of SECTIONS) {
      // radial along the axis: starts 0.1 inside R, exits at R + depth
      const t = firstArenaExitFraction(s.map({ x: R - 0.1, y: 0 }), s.map({ x: RD + 0.1, y: 0 }), ARENA)!
      expect(t).toBeCloseTo((D + 0.1) / (D + 0.2), 12)
      // radial at half the window angle
      const p0 = s.map(polar(R - 0.05, H / 2))
      const p1 = s.map(polar(RD + 0.05, H / 2))
      expect(firstArenaExitFraction(p0, p1, ARENA)!).toBeCloseTo((D + 0.05) / (D + 0.1), 12)
      // a radial move that only reaches the Tokudawara band stays IN
      expect(firstArenaExitFraction(s.map({ x: R - 0.1, y: 0 }), s.map({ x: R + D / 2, y: 0 }), ARENA)).toBeNull()
    }
  })

  it('leaving a window through its side boundary exits at the side line (all eight sides)', () => {
    for (const side of EVERY_SIDE) {
      // from the Tokudawara band, move tangentially out of the window: OUT as soon as the side is passed
      const p0 = side.map({ x: R + D / 2, y: 0 })
      const p1 = side.map({ x: R + D / 2, y: (R + D / 2) * Math.tan(H * 1.5) })
      const t = firstArenaExitFraction(p0, p1, ARENA)!
      const expected = lineParam({ x: R + D / 2, y: 0 }, { x: R + D / 2, y: (R + D / 2) * Math.tan(H * 1.5) }, H)
      expect(t, side.name).toBeCloseTo(expected, 12)
      // IN up to the side line, OUT right after it (the side point itself is only an ulp from either)
      expect(isOutOfArena(lerp(p0, p1, t - 1e-9), ARENA)).toBe(false)
      expect(isOutOfArena(lerp(p0, p1, t + 1e-9), ARENA)).toBe(true)
    }
  })

  it('entering a window through its side from inside the circle is not an exit (all eight sides)', () => {
    for (const side of EVERY_SIDE) {
      // inside R just outside the window -> into the Tokudawara band through the side (crossing it below R)
      const from = polar(R - 0.05, H + 0.01)
      const to = polar(R + 0.06, H - 0.03)
      const p0 = side.map(from)
      const p1 = side.map(to)
      const sideT = lineParam(from, to, H)
      expect(radial(lerp(from, to, sideT))).toBeLessThan(R)
      expect(firstArenaExitFraction(p0, p1, ARENA), side.name).toBeNull()
    }
  })

  it('corner-near and tangent cases', () => {
    for (const side of EVERY_SIDE) {
      // through the corner (R on the side line) from inside the circle into the band: stays IN
      const corner = polar(R, H)
      const into = polar(R + 0.03, H - 0.005)
      const back = { x: 2 * corner.x - into.x, y: 2 * corner.y - into.y }
      expect(isOutOfArena(side.map(back), ARENA)).toBe(false)
      const t = firstArenaExitFraction(side.map(back), side.map(into), ARENA)
      if (t !== null) {
        // only a sub-ulp sliver at the corner may count; never a material exit
        expect(t).toBeGreaterThan(0.5 - 1e-9)
        expect(t).toBeLessThan(0.5 + 1e-9)
      }
      // tangent to the Tokudawara outer arc at the axis: starting on the boundary, OUT immediately
      const s = SECTIONS[EVERY_SIDE.indexOf(side) >> 1]
      expect(firstArenaExitFraction(s.map({ x: RD, y: 0 }), s.map({ x: RD, y: 0.05 }), ARENA)).toBe(0)
    }
    // tangent along the exact outer arc point of the EXACT fixture
    expect(firstArenaExitFraction({ x: 5.25, y: 0 }, { x: 5.25, y: 0.1 }, EXACT)).toBe(0)
    // tangent from an exact normal-section boundary point: exits at once (the tangent direction is only
    // representable to an ulp, so the root may be ~1e-15 instead of 0)
    const tangent = firstArenaExitFraction({ x: 3, y: 4 }, { x: 3.8, y: 3.4 }, EXACT)!
    expect(tangent).toBeGreaterThanOrEqual(0)
    expect(tangent).toBeLessThan(1e-12)
    expect(firstArenaExitFraction({ x: 3, y: 4 }, { x: 0, y: 0 }, EXACT)).toBeNull() // inward from the line
  })

  it('P0 already OUT -> 0; P0 IN / P1 OUT -> the exit; no exit -> null', () => {
    for (const s of SECTIONS) {
      expect(firstArenaExitFraction(s.map({ x: RD + 0.1, y: 0 }), s.map({ x: RD + 0.2, y: 0 }), ARENA)).toBe(0)
      expect(firstArenaExitFraction(s.map(polar(R + 0.05, Math.PI / 4)), s.map({ x: 0, y: 0 }), ARENA)).toBe(0)
      expect(firstArenaExitFraction(s.map({ x: 0, y: 0 }), s.map({ x: 1, y: 0.5 }), ARENA)).toBeNull()
      expect(firstArenaExitFraction(s.map({ x: R + 0.01, y: 0 }), s.map({ x: RD - 0.01, y: 0.01 }), ARENA)).toBeNull()
      expect(firstArenaExitFraction(s.map({ x: 1, y: 1 }), s.map({ x: 1, y: 1 }), ARENA)).toBeNull() // no move
    }
  })

  it('P0 IN and P1 IN but the move leaves and re-enters: the first exit is returned (all eight sides)', () => {
    // From the Tokudawara band, cut the corner through the outside notch back into the circle.
    const p0 = polar(R + 0.06, H - 0.01)
    const p1 = polar(R - 0.06, H + 0.03)
    const sideT = lineParam(p0, p1, H)
    expect(radial(lerp(p0, p1, sideT))).toBeGreaterThan(R) // the side is crossed outside the circle
    for (const side of EVERY_SIDE) {
      const a = side.map(p0)
      const b = side.map(p1)
      expect(isOutOfArena(a, ARENA) || isOutOfArena(b, ARENA)).toBe(false)
      const t = firstArenaExitFraction(a, b, ARENA)!
      expect(t, side.name).toBeCloseTo(sideT, 12)
    }
    // ...and the outcome counts even though the resolved end state is IN
    const still = { id: 'b', previous: { x: 0, y: 0 }, current: { x: 0, y: 0 } }
    expect(resolveArenaRingOut([{ id: 'a', previous: p0, current: p1 }, still], ARENA)).toEqual({
      kind: 'win',
      winnerId: 'b',
      loserId: 'a',
      reason: 'ring-out',
    })
  })

  it('IN -> OUT -> IN -> OUT returns the first exit, not the final one (all eight sides)', () => {
    // Same corner cut, continued through the circle and out on the far side.
    const p0 = polar(R + 0.06, H - 0.01)
    const via = polar(R - 0.06, H + 0.03)
    const p1 = { x: p0.x + 40 * (via.x - p0.x), y: p0.y + 40 * (via.y - p0.y) }
    expect(isOutOfArena(p1, ARENA)).toBe(true)
    const sideT = lineParam(p0, p1, H)
    const lastIn = firstRingBoundaryCrossingFraction(polar(R - 0.06, H + 0.03), p1, R)! // far-side circle exit
    for (const side of EVERY_SIDE) {
      const t = firstArenaExitFraction(side.map(p0), side.map(p1), ARENA)!
      expect(t, side.name).toBeCloseTo(sideT, 12)
      expect(t).toBeLessThan(0.05)
      expect(lastIn).toBeGreaterThan(0)
      // the move is IN again later in the tick (re-entered the circle)
      expect(isOutOfArena(side.map(lerp(p0, p1, 0.5)), ARENA)).toBe(false)
    }
  })

  it('agrees with a dense sampling oracle on deterministic pseudo-random moves near the boundary', () => {
    let seed = 12345
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const SAMPLES = 2000
    let exits = 0
    let reentries = 0
    for (let i = 0; i < 1500; i++) {
      const p0 = polar(R - 0.15 + 0.3 * rand(), rand() * Math.PI * 2)
      const step = 0.02 + 0.25 * rand()
      const dir = rand() * Math.PI * 2
      const p1 = { x: p0.x + Math.cos(dir) * step, y: p0.y + Math.sin(dir) * step }
      const t = firstArenaExitFraction(p0, p1, ARENA)
      if (isOutOfArena(p0, ARENA)) {
        expect(t).toBe(0)
        continue
      }
      let firstOut = -1
      for (let k = 1; k <= SAMPLES; k++) {
        if (isOutOfArena(lerp(p0, p1, k / SAMPLES), ARENA)) {
          firstOut = k
          break
        }
      }
      if (t === null) {
        expect(firstOut).toBe(-1)
        continue
      }
      exits++
      if (!isOutOfArena(p1, ARENA)) reentries++
      expect(Number.isFinite(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThan(1)
      if (firstOut !== -1) expect(t).toBeLessThanOrEqual(firstOut / SAMPLES)
      if (t > 1e-9) expect(isOutOfArena(lerp(p0, p1, t - 1e-9), ARENA)).toBe(false)
      expect(isOutOfArena(lerp(p0, p1, Math.min(1, t + 1e-9)), ARENA)).toBe(true)
    }
    expect(exits).toBeGreaterThan(100)
    expect(reentries).toBeGreaterThan(0)
  })

  it('without Tokudawara the crossing is the unchanged circle helper (bit-identical)', () => {
    const circle: ArenaSetup = { radius: R }
    const cases: [Vec2, Vec2][] = [
      [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: R, y: 0 }, { x: R + 1, y: 0 }],
      [{ x: 0, y: R - 1 }, { x: 0, y: R + 1 }],
      [polar(R - 0.3, 0.7), polar(R + 0.1, 0.7)],
      [{ x: R, y: 0 }, { x: -(R + 1), y: 0 }],
      [{ x: R - 1e-12, y: 0 }, { x: R - 1e-12, y: 0.5 }],
      [{ x: R + 1, y: 0 }, { x: R + 2, y: 0 }],
    ]
    for (const [p0, p1] of cases) {
      expect(Object.is(firstArenaExitFraction(p0, p1, circle), firstRingBoundaryCrossingFraction(p0, p1, R))).toBe(true)
    }
    const entries = [
      { id: 'a', previous: { x: R - 0.001, y: 0 }, current: { x: R + 0.001, y: 0 } },
      { id: 'b', previous: { x: -(R - 0.5), y: 0 }, current: { x: -(R + 0.3), y: 0 } },
    ] as const
    expect(resolveArenaRingOut(entries, circle)).toEqual(resolveRingOut(entries, R))
  })
})

const win = (winnerId: string, loserId: string) => ({ kind: 'win', winnerId, loserId, reason: 'ring-out' })
const REMATCH = { kind: 'rematch', reason: 'simultaneous-ring-out' }

describe('Tokudawara ring-out resolution (TOKUDAWARA-01A)', () => {
  // Radial move of length 1 through the +x Tokudawara outer arc: exit fraction 0.5 - offset.
  const viaArc = (id: string, offset: number, map = SECTIONS[0].map) => ({
    id,
    previous: map({ x: RD - 0.5 + offset, y: 0 }),
    current: map({ x: RD + 0.5 + offset, y: 0 }),
  })

  it('the earlier exit loses (player first / CPU first), neither exiting is ongoing', () => {
    expect(resolveArenaRingOut([viaArc('a', 0.1), viaArc('b', 0, SECTIONS[2].map)], ARENA)).toEqual(win('b', 'a'))
    expect(resolveArenaRingOut([viaArc('a', 0, SECTIONS[1].map), viaArc('b', 0.1, SECTIONS[3].map)], ARENA)).toEqual(win('a', 'b'))
    const inside = (id: string) => ({ id, previous: { x: R + 0.01, y: 0 }, current: { x: RD, y: 0 } })
    expect(resolveArenaRingOut([inside('a'), { ...inside('b'), previous: { x: -R, y: 0 }, current: { x: -RD, y: 0 } }], ARENA)).toEqual({
      kind: 'ongoing',
    })
  })

  it('mirrored equal exits are a Rematch (x, y, and x <-> y mirrors)', () => {
    for (const [ma, mb] of [
      [0, 2],
      [1, 3],
      [0, 1],
    ]) {
      expect(resolveArenaRingOut([viaArc('a', 0, SECTIONS[ma].map), viaArc('b', 0, SECTIONS[mb].map)], ARENA)).toEqual(REMATCH)
    }
    // mirrored side exits (corner cut) are equal too
    const p0 = polar(R + 0.06, H - 0.01)
    const p1 = polar(R - 0.06, H + 0.03)
    const mirrored = EVERY_SIDE.map((s) => ({ previous: s.map(p0), current: s.map(p1) }))
    for (let i = 1; i < mirrored.length; i++) {
      expect(resolveArenaRingOut([{ id: 'a', ...mirrored[0] }, { id: 'b', ...mirrored[i] }], ARENA)).toEqual(REMATCH)
    }
  })

  it('the simultaneous epsilon is unchanged: within it Rematch, beyond it the earlier exit loses', () => {
    expect(RING_OUT_SIMULTANEOUS_EPSILON).toBe(1e-9)
    expect(resolveArenaRingOut([viaArc('a', 0), viaArc('b', 0.5e-9, SECTIONS[2].map)], ARENA)).toEqual(REMATCH)
    expect(resolveArenaRingOut([viaArc('a', 0), viaArc('b', 3e-9, SECTIONS[2].map)], ARENA)).toEqual(win('a', 'b'))
    expect(resolveArenaRingOut([viaArc('a', 3e-9), viaArc('b', 0, SECTIONS[2].map)], ARENA)).toEqual(win('b', 'a'))
  })

  it('one exits via a Tokudawara arc, the other via the normal circle: compared by exit fraction', () => {
    const viaCircle = (id: string, from: number) => ({
      id,
      previous: polar(R - from, Math.PI / 4),
      current: polar(R + (1 - from), Math.PI / 4),
    })
    // arc exit at 0.5; circle exit at 0.4 / 0.6
    expect(resolveArenaRingOut([viaArc('a', 0), viaCircle('b', 0.4)], ARENA)).toEqual(win('a', 'b'))
    expect(resolveArenaRingOut([viaArc('a', 0), viaCircle('b', 0.6)], ARENA)).toEqual(win('b', 'a'))
    // the same moves on a plain circle: the +x mover would have exited earlier at R
    expect(firstArenaExitFraction(viaArc('a', 0).previous, viaArc('a', 0).current, { radius: R })!).toBeCloseTo(0.5 - D, 12)
  })

  it('resolution is deterministic', () => {
    const e = [viaArc('a', 0.01), viaArc('b', 0.02, SECTIONS[1].map)] as const
    const first = resolveArenaRingOut(e, ARENA)
    for (let i = 0; i < 5; i++) expect(resolveArenaRingOut(e, ARENA)).toEqual(first)
    expect(ringOutSource).not.toMatch(/from ['"]phaser['"]/)
  })
})

// ---------------------------------------------------------------- Simulation integration

interface Input {
  move?: [number, number]
  push?: boolean
  counter?: boolean
  grip?: boolean
  drive?: boolean
}
const one = (i: Input): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: i.drive ?? false,
})
const intents = (a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const COMBINED = 2 * BODY_RADIUS

function setup(a: Vec2, b: Vec2, arena: ArenaSetup = ARENA): BoutSetup {
  return {
    arena,
    participants: [
      { id: 'a', position: a },
      { id: 'b', position: b },
    ],
  }
}

// Runs until decided; records the largest radial distance of `who` while the bout was still ongoing.
function runUntilDecided(sim: BoutSimulation, input: () => Map<ParticipantId, ParticipantIntent>, who: (s: BoutSnapshot) => Vec2, limit = 600) {
  let maxOngoing = 0
  for (let t = 0; t < limit; t++) {
    const before = sim.getSnapshot()
    sim.step(input())
    const after = sim.getSnapshot()
    if (after.outcome.kind !== 'ongoing') return { before, after, maxOngoing }
    maxOngoing = Math.max(maxOngoing, radial(who(after)))
  }
  throw new Error('bout not decided')
}

describe('Tokudawara in BoutSimulation (TOKUDAWARA-01A)', () => {
  it('walking out through each cardinal Tokudawara survives beyond R and loses only past R + depth', () => {
    for (const [ux, uy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const sim = new BoutSimulation(setup({ x: ux * (R - 0.2), y: uy * (R - 0.2) }, { x: -ux * 0.7, y: -uy * 0.7 }))
      const { before, after, maxOngoing } = runUntilDecided(sim, () => intents({ move: [ux, uy] }), (s) => A(s).position)
      expect(after.outcome).toEqual(win('b', 'a'))
      expect(maxOngoing).toBeGreaterThan(R) // survived in the Tokudawara extension
      expect(radial(A(before).position)).toBeLessThanOrEqual(RD)
      expect(radial(A(after).position)).toBeGreaterThan(RD)
    }
  })

  it('walking out diagonally (normal section) still loses at R', () => {
    for (const [ux, uy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const n = Math.SQRT1_2
      const sim = new BoutSimulation(setup({ x: ux * n * (R - 0.2), y: uy * n * (R - 0.2) }, { x: 0, y: 0 }))
      const { before, after, maxOngoing } = runUntilDecided(sim, () => intents({ move: [ux, uy] }), (s) => A(s).position)
      expect(after.outcome).toEqual(win('b', 'a'))
      expect(maxOngoing).toBeLessThanOrEqual(R)
      expect(radial(A(before).position)).toBeLessThanOrEqual(R)
      expect(radial(A(after).position)).toBeGreaterThan(R)
      expect(radial(A(after).position)).toBeLessThan(RD)
    }
  })

  it('a FREE Push toward +x: the opponent survives in the Tokudawara, loses past it, stays outside', () => {
    const sim = new BoutSimulation(setup({ x: 2.2 - COMBINED, y: 0 }, { x: 2.2, y: 0 }))
    let t = 0
    const { after, maxOngoing } = runUntilDecided(sim, () => intents({ push: t++ === 0 }), (s) => B(s).position)
    expect(after.outcome).toEqual(win('a', 'b'))
    expect(maxOngoing).toBeGreaterThan(R)
    expect(radial(B(after).position)).toBeGreaterThan(RD)
    // the same push on the plain circle decides earlier, at R
    const circle = new BoutSimulation(setup({ x: 2.2 - COMBINED, y: 0 }, { x: 2.2, y: 0 }, { radius: R }))
    let u = 0
    expect(runUntilDecided(circle, () => intents({ push: u++ === 0 }), (s) => B(s).position).maxOngoing).toBeLessThanOrEqual(R)
  })

  it('Grappled Drive yorikiri toward -x crosses the Tokudawara; outcome matches the resolver on resolved centers', () => {
    const sim = new BoutSimulation(setup({ x: -1.4 + COMBINED / 2, y: 0 }, { x: -1.4 - COMBINED / 2, y: 0 }))
    sim.step(intents({ grip: true }))
    expect(sim.getSnapshot().engagement.kind).toBe('grappled')
    const { before, after, maxOngoing } = runUntilDecided(sim, () => intents({ drive: true }), (s) => B(s).position)
    expect(after.outcome).toEqual(win('a', 'b'))
    expect(maxOngoing).toBeGreaterThan(R)
    expect(after.outcome).toEqual(
      resolveArenaRingOut(
        [
          { id: 'a', previous: A(before).position, current: A(after).position },
          { id: 'b', previous: B(before).position, current: B(after).position },
        ],
        ARENA,
      ),
    )
  })

  it('no wall; the decided bout is frozen exactly; replays are deterministic', () => {
    const run = () => {
      const sim = new BoutSimulation(setup({ x: 0, y: R - 0.2 }, { x: 0, y: -0.7 }))
      runUntilDecided(sim, () => intents({ move: [0, 1] }), (s) => A(s).position)
      return sim
    }
    const sim = run()
    const frozen = sim.getSnapshot()
    expect(radial(A(frozen).position)).toBeGreaterThan(RD)
    for (let k = 0; k < 60; k++) {
      sim.step(intents({ move: [0, -1], push: true }, { grip: true, drive: true }))
      expect(sim.getSnapshot()).toEqual(frozen)
    }
    expect(run().getSnapshot()).toEqual(frozen)
  })

  it('setup and snapshot keep Tokudawara as an isolated copy; a circle has no tokudawara key', () => {
    const mutable = { radius: R, tokudawara: { depth: D, halfAngle: H } }
    const sim = new BoutSimulation(setup({ x: 0, y: 0 }, { x: 1, y: 0 }, mutable))
    mutable.tokudawara.depth = 9
    mutable.radius = 9
    const snap = sim.getSnapshot()
    expect(snap.arena).toEqual({ radius: R, tokudawara: { depth: D, halfAngle: H } })
    ;(snap.arena.tokudawara as { depth: number }).depth = 7
    expect(sim.getSnapshot().arena.tokudawara).toEqual({ depth: D, halfAngle: H })
    const circle = new BoutSimulation(setup({ x: 0, y: 0 }, { x: 1, y: 0 }, { radius: R })).getSnapshot()
    expect('tokudawara' in circle.arena).toBe(false)
  })

  it('rejects invalid Tokudawara setups', () => {
    const bad = [
      { depth: 0, halfAngle: H },
      { depth: -0.1, halfAngle: H },
      { depth: NaN, halfAngle: H },
      { depth: Infinity, halfAngle: H },
      { depth: D, halfAngle: 0 },
      { depth: D, halfAngle: -H },
      { depth: D, halfAngle: Math.PI / 4 },
      { depth: D, halfAngle: NaN },
    ]
    for (const tokudawara of bad) {
      expect(() => new BoutSimulation(setup({ x: 0, y: 0 }, { x: 1, y: 0 }, { radius: R, tokudawara })), JSON.stringify(tokudawara)).toThrow(
        /tokudawara/,
      )
    }
  })

  it('Counter relocation keeps the conservative circular condition (never into a Tokudawara extension)', () => {
    // Fixture where the rear target (+x, 1.05 m) is invalid on the circle (1.25 - bodyRadius = 0.9) but
    // would fit inside a deep +x Tokudawara: the result must equal the plain-circle result.
    const ring = 1.25
    const run = (arena: ArenaSetup) => {
      const sim = new BoutSimulation(setup({ x: -COMBINED / 2, y: 0 }, { x: COMBINED / 2, y: 0 }, arena))
      for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
      return sim.getSnapshot()
    }
    const circle = run({ radius: ring })
    const tokudawara = run({ radius: ring, tokudawara: { depth: 0.3, halfAngle: H } })
    expect(B(tokudawara).posture.kind).toBe('kuzushi')
    expect(tokudawara.participants).toEqual(circle.participants)
    expect(radial(A(tokudawara).position)).toBeLessThanOrEqual(ring - BODY_RADIUS + 1e-12)
    expect(tokudawara.outcome).toEqual({ kind: 'ongoing' })
  })
})
