import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, COUNTER_TRANSITION_TICKS, PUSH_STARTUP_TICKS } from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, Vec2 } from './BoutTypes.ts'
import {
  RING_OUT_SIMULTANEOUS_EPSILON,
  firstRingBoundaryCrossingFraction,
  isOutOfRing,
  resolveRingOut,
} from './ringOut.ts'
import ringOutSource from './ringOut.ts?raw'

const COMBINED = 2 * BODY_RADIUS
const R = 5

function setupAt(ax: number, ay: number, bx: number, by: number, radius = R): BoutSetup {
  return {
    arena: { radius },
    participants: [
      { id: 'a', position: { x: ax, y: ay } },
      { id: 'b', position: { x: bx, y: by } },
    ],
  }
}

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

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  return new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
}

const IDLE = intents()
const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const radial = (p: Vec2) => Math.hypot(p.x, p.y)
const win = (winnerId: string, loserId: string) => ({ kind: 'win', winnerId, loserId, reason: 'ring-out' })
const REMATCH = { kind: 'rematch', reason: 'simultaneous-ring-out' }

// Steps until the outcome is decided; returns the snapshots around the deciding tick.
function runUntilDecided(sim: BoutSimulation, input: () => Map<ParticipantId, ParticipantIntent>, limit = 400) {
  for (let t = 0; t < limit; t++) {
    const before = sim.getSnapshot()
    sim.step(input())
    const after = sim.getSnapshot()
    if (after.outcome.kind !== 'ongoing') return { t, before, after }
  }
  throw new Error('bout not decided')
}

// A walks out toward +x, B toward -x, both from rest; never in contact.
function walkOut(gapA: number, gapB: number, speedA = 1, speedB = 1) {
  const sim = new BoutSimulation(setupAt(R - gapA, 0, -(R - gapB), 0))
  return runUntilDecided(sim, () => intents({ move: [speedA, 0] }, { move: [-speedB, 0] }))
}

describe('Ring-out / BoutOutcome (ACTION-06A)', () => {
  it('T151: a new bout is ongoing and the outcome snapshot is an isolated copy', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 1, 0))
    expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' })
    const s = sim.getSnapshot()
    ;(s.outcome as unknown as { kind: string }).kind = 'win'
    expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' })
    const decided = walkOut(0.2, 1)
    const copy = decided.after.outcome as unknown as { winnerId: string }
    copy.winnerId = 'x'
    expect(decided.after.outcome.kind).toBe('win')
  })

  it('T152: exactly on the ring is IN; just inside IN; just outside OUT (several directions)', () => {
    // exactly representable points on the ring (3-4-5) are IN
    for (const p of [{ x: R, y: 0 }, { x: 0, y: -R }, { x: 3, y: 4 }, { x: -4, y: -3 }]) expect(isOutOfRing(p, R)).toBe(false)
    for (const [ux, uy] of [[1, 0], [0, -1], [-Math.SQRT1_2, Math.SQRT1_2], [0.6, 0.8]]) {
      expect(isOutOfRing({ x: ux * (R - 1e-9), y: uy * (R - 1e-9) }, R)).toBe(false)
      expect(isOutOfRing({ x: ux * (R + 1e-9), y: uy * (R + 1e-9) }, R)).toBe(true)
    }
    // exactly on the ring in the Simulation: still ongoing
    const sim = new BoutSimulation(setupAt(R, 0, -1, 0))
    sim.step(IDLE)
    expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' })
  })

  it('T153 / T154: only one participant OUT -> it loses (both directions)', () => {
    expect(walkOut(0.2, 2).after.outcome).toEqual(win('b', 'a'))
    expect(walkOut(2, 0.2).after.outcome).toEqual(win('a', 'b'))
  })

  it('T155: the participant out in an earlier tick loses; the later one cannot overwrite it', () => {
    const { t, after } = walkOut(0.2, 0.4)
    expect(isOutOfRing(B(after).position, R)).toBe(false)
    expect(after.outcome).toEqual(win('b', 'a'))
    expect(t).toBeGreaterThan(0)
  })

  it('T156 / T157: both OUT in the same tick -> the earlier crossing loses (both orders)', () => {
    for (const [gapA, gapB, loser] of [
      [0.2, 0.205, 'a'],
      [0.205, 0.2, 'b'],
    ] as const) {
      const { before, after } = walkOut(gapA, gapB)
      expect(isOutOfRing(A(before).position, R) || isOutOfRing(B(before).position, R)).toBe(false)
      expect(isOutOfRing(A(after).position, R) && isOutOfRing(B(after).position, R)).toBe(true)
      const ta = firstRingBoundaryCrossingFraction(A(before).position, A(after).position, R)!
      const tb = firstRingBoundaryCrossingFraction(B(before).position, B(after).position, R)!
      expect(loser === 'a' ? ta < tb : tb < ta).toBe(true)
      expect(after.outcome).toEqual(loser === 'a' ? win('b', 'a') : win('a', 'b'))
    }
  })

  it('T158: outside depth is not used: the earlier but shallower crosser still loses (both orders)', () => {
    for (const mirror of [false, true]) {
      // A walks slowly from just inside; B runs from further in and ends deeper, in the same tick.
      const { before, after } = mirror ? walkOut(0.365, 0.2, 1, 0.3) : walkOut(0.2, 0.365, 0.3, 1)
      const early = mirror ? B : A
      const late = mirror ? A : B
      expect(isOutOfRing(late(after).position, R)).toBe(true)
      const tEarly = firstRingBoundaryCrossingFraction(early(before).position, early(after).position, R)!
      const tLate = firstRingBoundaryCrossingFraction(late(before).position, late(after).position, R)!
      expect(tEarly).toBeLessThan(tLate)
      expect(radial(early(after).position)).toBeLessThan(radial(late(after).position)) // shallower
      expect(after.outcome).toEqual(mirror ? win('a', 'b') : win('b', 'a'))
    }
    // pure fixture: earlier & shallower loses, later & deeper wins
    expect(
      resolveRingOut(
        [
          { id: 'a', previous: { x: R - 0.001, y: 0 }, current: { x: R + 0.001, y: 0 } }, // t = 0.5, depth 0.001
          { id: 'b', previous: { x: -(R - 0.5), y: 0 }, current: { x: -(R + 0.3), y: 0 } }, // t = 0.625, depth 0.3
        ],
        R,
      ),
    ).toEqual(win('b', 'a'))
  })

  it('T159: mirrored equal crossings in the same tick -> Draw Rematch', () => {
    expect(walkOut(0.2, 0.2).after.outcome).toEqual(REMATCH)
    expect(walkOut(0.37, 0.37, 0.6, 0.6).after.outcome).toEqual(REMATCH)
  })

  it('T160: crossing fractions within the technical epsilon are simultaneous; beyond it they are not', () => {
    // straight radial moves of length 1 starting 0.5 inside: crossing fraction = 0.5 - offset
    const entry = (id: string, offset: number) => ({
      id,
      previous: { x: R - 0.5 + offset, y: 0 },
      current: { x: R + 0.5 + offset, y: 0 },
    })
    expect(RING_OUT_SIMULTANEOUS_EPSILON).toBe(1e-9)
    expect(resolveRingOut([entry('a', 0), entry('b', 0.5e-9)], R)).toEqual(REMATCH)
    expect(resolveRingOut([entry('a', 0), entry('b', 3e-9)], R)).toEqual(win('a', 'b')) // b crossed earlier
    expect(resolveRingOut([entry('a', 3e-9), entry('b', 0)], R)).toEqual(win('b', 'a'))
  })

  it('T161: crossing helper: IN -> IN null, boundary -> OUT 0, cardinal / diagonal, range [0, 1)', () => {
    expect(firstRingBoundaryCrossingFraction({ x: 0, y: 0 }, { x: 1, y: 1 }, R)).toBeNull()
    expect(firstRingBoundaryCrossingFraction({ x: R, y: 0 }, { x: R + 1, y: 0 }, R)).toBe(0)
    expect(firstRingBoundaryCrossingFraction({ x: 0, y: R - 1 }, { x: 0, y: R + 1 }, R)).toBeCloseTo(0.5, 12)
    expect(firstRingBoundaryCrossingFraction({ x: -(R - 0.2), y: 0 }, { x: -(R + 0.6), y: 0 }, R)).toBeCloseTo(0.25, 12)
    const d = Math.SQRT1_2
    expect(firstRingBoundaryCrossingFraction({ x: d * (R - 0.3), y: d * (R - 0.3) }, { x: d * (R + 0.1), y: d * (R + 0.1) }, R)).toBeCloseTo(0.75, 12)
    // from the boundary heading inward first: exits on the far side (chord through the circle)
    expect(firstRingBoundaryCrossingFraction({ x: R, y: 0 }, { x: -(R + 1), y: 0 }, R)).toBeCloseTo((2 * R) / (2 * R + 1), 12)
    // tangential exit and a tiny step past the line stay in range
    const tan = firstRingBoundaryCrossingFraction({ x: R - 1e-12, y: 0 }, { x: R - 1e-12, y: 0.5 }, R)!
    expect(tan).toBeGreaterThanOrEqual(0)
    expect(tan).toBeLessThan(1)
    const tiny = firstRingBoundaryCrossingFraction({ x: R - 1e-12, y: 0 }, { x: R + 1e-12, y: 0 }, R)!
    expect(tiny).toBeGreaterThanOrEqual(0)
    expect(tiny).toBeLessThan(1)
    // defensive: already OUT at the start of the tick
    expect(firstRingBoundaryCrossingFraction({ x: R + 1, y: 0 }, { x: R + 2, y: 0 }, R)).toBe(0)
  })

  it('T162: the centre criterion ignores body size (no support-radius rule)', () => {
    const at = (x: number) => ({ id: 'a', previous: { x: 0, y: 0 }, current: { x, y: 0 } })
    const inside = { id: 'b', previous: { x: 0, y: 0 }, current: { x: 0, y: 0 } }
    // bodies overhang the line by bodyRadius before losing: only the center counts
    expect(resolveRingOut([at(R - BODY_RADIUS / 2), inside], R)).toEqual({ kind: 'ongoing' })
    expect(resolveRingOut([at(R), inside], R)).toEqual({ kind: 'ongoing' })
    expect(ringOutSource).not.toMatch(/bodyRadius|support/)
  })

  it('T163: a FREE Push drives the opponent out: it loses and stays outside', () => {
    const ring = 2.275
    const sim = new BoutSimulation(setupAt(2.2 - COMBINED, 0, 2.2, 0, ring))
    sim.step(IDLE)
    expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' }) // standing near the line is fine
    let t = 0
    const { after } = runUntilDecided(sim, () => intents({ push: t++ === 0 }))
    expect(after.outcome).toEqual(win('a', 'b'))
    expect(radial(B(after).position)).toBeGreaterThan(ring)
    expect(radial(A(after).position)).toBeLessThanOrEqual(ring)
    expect(A(after).action.kind).toBe('push') // final state kept, not normalized
  })

  it('T164: Grappled Drive yorikiri: the front participant crosses first and loses; bond unclamped', () => {
    const ring = 2.275
    const sim = new BoutSimulation(setupAt(1.4 - COMBINED / 2, 0, 1.4 + COMBINED / 2, 0, ring))
    sim.step(intents({ grip: true }))
    expect(sim.getSnapshot().engagement.kind).toBe('grappled')
    const { after } = runUntilDecided(sim, () => intents({ drive: true }))
    expect(after.outcome).toEqual(win('a', 'b'))
    expect(Math.hypot(B(after).position.x - A(after).position.x, B(after).position.y - A(after).position.y)).toBeCloseTo(COMBINED, 12)
    expect(radial(B(after).position)).toBeGreaterThan(ring)

    // mirrored: B drives A out
    const m = new BoutSimulation(setupAt(-1.4 - COMBINED / 2, 0, -1.4 + COMBINED / 2, 0, ring))
    m.step(intents({}, { grip: true }))
    expect(runUntilDecided(m, () => intents({}, { drive: true })).after.outcome).toEqual(win('b', 'a'))
  })

  it('T165: Counter target near the edge keeps its accepted validity and never places the end center outside', () => {
    // ACTION-04A4: the target is taken around the pusher's stagger end point; here the rear is invalid
    // (max center distance 0.8) and a side is used. The transition itself runs to completion.
    const ring = 1.15
    const sim = new BoutSimulation(setupAt(-COMBINED / 2 + 0.2, 0, COMBINED / 2 + 0.2, 0, ring))
    for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
    expect(B(sim.getSnapshot()).posture.kind).toBe('kuzushi')
    expect(sim.getSnapshot().counterTransition).toMatchObject({ kind: 'active', tier: 'best' })
    for (let k = 0; k < COUNTER_TRANSITION_TICKS; k++) {
      sim.step(IDLE)
      expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' })
    }
    const s = sim.getSnapshot()
    expect(s.counterTransition).toEqual({ kind: 'none' })
    expect(radial(A(s).position)).toBeLessThanOrEqual(ring - BODY_RADIUS + 1e-12)
    expect(Math.abs(A(s).position.y)).toBeCloseTo(COMBINED, 9) // a side, not the rear
  })

  it('T166 / T167 / T168: no wall; the decided bout is frozen exactly; the outcome cannot change', () => {
    const { after } = walkOut(0.2, 0.4)
    expect(radial(A(after).position)).toBeGreaterThan(R) // not clamped or bounced back
    const inputs = [
      intents({ move: [-1, 0], push: true }, { move: [-1, 0], counter: true }),
      intents({ grip: true, drive: true }, { grip: true, drive: true }),
      IDLE,
    ]
    const sim = new BoutSimulation(setupAt(R - 0.2, 0, -(R - 0.4), 0))
    runUntilDecided(sim, () => intents({ move: [1, 0] }, { move: [-1, 0] }))
    const frozen = sim.getSnapshot()
    expect(frozen).toEqual(after)
    for (let k = 0; k < 120; k++) {
      sim.step(inputs[k % inputs.length])
      expect(sim.getSnapshot()).toEqual(frozen)
    }
    expect(frozen.outcome).toEqual(win('b', 'a')) // B never gets to cross later
    expect(radial(B(frozen).position)).toBeLessThanOrEqual(R)
  })

  it('T169: a fresh BoutSimulation is a new, ongoing bout', () => {
    walkOut(0.2, 0.4)
    expect(new BoutSimulation(setupAt(R - 0.2, 0, -(R - 0.4), 0)).getSnapshot().outcome).toEqual({ kind: 'ongoing' })
  })

  it('T170: ring-out uses only the previous and final resolved centers (no hidden solver sub-steps)', () => {
    // Grip attach on the deciding tick: B starts exactly on the line, is pulled inward by the attach;
    // the resolved tick ends IN, so there is no ring-out even though B began on the boundary.
    const ring = 2.275
    const sim = new BoutSimulation(setupAt(ring - COMBINED - 0.08, 0, ring, 0, ring))
    sim.step(intents({ grip: true }))
    expect(sim.getSnapshot().engagement.kind).toBe('grappled')
    expect(sim.getSnapshot().outcome).toEqual({ kind: 'ongoing' })

    // Drive ticks include a bond correction; the decision matches the helper on resolved snapshots.
    const d = new BoutSimulation(setupAt(1.4 - COMBINED / 2, 0.3, 1.4 + COMBINED / 2, 0.3, ring))
    d.step(intents({ grip: true }))
    const { before, after } = runUntilDecided(d, () => intents({ drive: true }))
    expect(after.outcome).toEqual(
      resolveRingOut(
        [
          { id: 'a', previous: A(before).position, current: A(after).position },
          { id: 'b', previous: B(before).position, current: B(after).position },
        ],
        ring,
      ),
    )
  })

  it('T171: Push / Drive / rematch scenarios replay identically with finite values', () => {
    const scenarios = [
      () => walkOut(0.2, 0.205).after,
      () => walkOut(0.2, 0.2).after,
      () => {
        const sim = new BoutSimulation(setupAt(1.4 - COMBINED / 2, 0.1, 1.4 + COMBINED / 2, 0.1, 2.275))
        sim.step(intents({ grip: true }))
        return runUntilDecided(sim, () => intents({ drive: true }, { move: [0, 1] })).after
      },
    ]
    for (const run of scenarios) {
      const s = run()
      expect(run()).toEqual(s)
      for (const p of s.participants) {
        for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.facing]) expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('T172: the outcome is top-level only; participants carry no winner / loser flags', () => {
    const { after } = walkOut(0.2, 1)
    expect(Object.keys(after).sort()).toEqual(['arena', 'counterTransition', 'engagement', 'outcome', 'participants'])
    for (const p of after.participants) {
      expect(Object.keys(p).sort()).toEqual(
        ['action', 'bodyRadius', 'externalVelocity', 'facing', 'id', 'position', 'posture', 'velocity'].sort(),
      )
    }
    expect(ringOutSource).not.toMatch(/from ['"]phaser['"]/)
  })
})
