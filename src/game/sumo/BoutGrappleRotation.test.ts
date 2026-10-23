import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  GRAPPLE_DRIVE_ACCELERATION,
  GRAPPLE_MANUAL_ROTATION_RATE,
  GRIP_MIN_ATTEMPT_TICKS,
  PUSH_STARTUP_TICKS,
  TICK_SECONDS,
  grappleManualRotationIntent,
  rotateGrappledPair,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, Vec2 } from './BoutTypes.ts'
import { GRAPPLE_FACING_TOLERANCE, canActInGrapple, grappleFacingError } from './grappleOrientation.ts'
import { PushDummyController } from '../input/pushDummyController.ts'
import simulationSource from './BoutSimulation.ts?raw'

const COMBINED = 2 * BODY_RADIUS
const DELTA = GRAPPLE_MANUAL_ROTATION_RATE * TICK_SECONDS // one full-intent tick (1.5 deg)
const W: [number, number] = [0, -1]
const S: [number, number] = [0, 1]
const A_KEY: [number, number] = [-1, 0]
const D: [number, number] = [1, 0]

type Input = { move?: [number, number]; grip?: boolean; drive?: boolean; push?: boolean; counter?: boolean }
const one = (i: Input): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  tsuppariLeftPressed: false,
  tsuppariRightPressed: false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: i.drive ?? false,
})
const intents = (a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
const IDLE = intents()

function setup(a: Vec2, b: Vec2, radius = 100, swapped = false): BoutSetup {
  const pa = { id: 'a', position: a }
  const pb = { id: 'b', position: b }
  return { arena: { radius }, participants: swapped ? [pb, pa] : [pa, pb] }
}
const byId = (s: BoutSnapshot, id: ParticipantId) => s.participants.find((p) => p.id === id)!
const A = (s: BoutSnapshot) => byId(s, 'a')
const B = (s: BoutSnapshot) => byId(s, 'b')
const dist = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const axisAngle = (s: BoutSnapshot) => Math.atan2(B(s).position.y - A(s).position.y, B(s).position.x - A(s).position.x)
const midpoint = (s: BoutSnapshot) => ({ x: (A(s).position.x + B(s).position.x) / 2, y: (A(s).position.y + B(s).position.y) / 2 })
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x))
const bothReady = (s: BoutSnapshot) =>
  canActInGrapple(A(s), B(s), s.engagement) && canActInGrapple(B(s), A(s), s.engagement)

// A grips B in contact (ACTION-11C: lands GRIP_MIN_ATTEMPT_TICKS after the press); a frontal grip is READY at once.
function gripFrom(a: Vec2, b: Vec2, radius = 100, swapped = false): BoutSimulation {
  const sim = new BoutSimulation(setup(a, b, radius, swapped))
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(IDLE)
  const s = sim.getSnapshot()
  expect(s.engagement.kind).toBe('grappled')
  expect(bothReady(s)).toBe(true)
  return sim
}
const horizontal = (swapped = false) => gripFrom({ x: -COMBINED / 2, y: 0 }, { x: COMBINED / 2, y: 0 }, 100, swapped)

// B pushes on tick 0, A's Counter is Best (rear), the transition runs, A grips the Kuzushi B: B starts TURNING.
function rearGrip(): BoutSimulation {
  const sim = new BoutSimulation(setup({ x: -COMBINED / 2, y: 0 }, { x: COMBINED / 2, y: 0 }))
  for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
  for (let t = 0; t < COUNTER_TRANSITION_TICKS; t++) sim.step(IDLE)
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(IDLE)
  const s = sim.getSnapshot()
  expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  expect(bothReady(s)).toBe(false)
  return sim
}

// B fails a Counter in contact (Kuzushi), A grips: a frontal Morozashi with A holding, both READY.
function morozashi(): BoutSimulation {
  const sim = new BoutSimulation(setup({ x: -COMBINED / 2, y: 0 }, { x: COMBINED / 2, y: 0 }))
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({}, { counter: t === 0 }))
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(IDLE)
  const s = sim.getSnapshot()
  expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  expect(bothReady(s)).toBe(true)
  return sim
}

function expectRigidStep(before: BoutSnapshot, after: BoutSnapshot, delta: number): void {
  expect(dist(after)).toBeCloseTo(COMBINED, 12)
  expect(midpoint(after).x).toBeCloseTo(midpoint(before).x, 12)
  expect(midpoint(after).y).toBeCloseTo(midpoint(before).y, 12)
  expect(wrap(axisAngle(after) - axisAngle(before))).toBeCloseTo(delta, 12)
  for (const p of after.participants) {
    expect(p.velocity).toEqual({ x: 0, y: 0 }) // no self / external velocity from the rotation
    expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
  }
}

describe('Grapple WASD rotation (ACTION-12B)', () => {
  it('pure intent: tangential projection, radial zero, symmetric clamp, coincident centers zero', () => {
    const a = { x: -0.35, y: 0 }
    const b = { x: 0.35, y: 0 }
    const v = (m: [number, number]) => ({ x: m[0], y: m[1] })
    const z = { x: 0, y: 0 }
    expect(grappleManualRotationIntent(a, v(W), b, z)).toBe(1)
    expect(grappleManualRotationIntent(a, v(S), b, z)).toBe(-1)
    expect(grappleManualRotationIntent(a, v(D), b, z)).toBe(0)
    expect(grappleManualRotationIntent(a, v(A_KEY), b, z)).toBe(0)
    expect(grappleManualRotationIntent(a, z, b, v(W))).toBe(-1)
    expect(grappleManualRotationIntent(a, v(W), b, v(S))).toBe(1) // same sense clamps
    expect(grappleManualRotationIntent(a, v(W), b, v(W))).toBe(0) // opposite sense cancels
    expect(grappleManualRotationIntent(a, v(W), b, v(S))).toBe(grappleManualRotationIntent(b, v(S), a, v(W))) // order
    expect(grappleManualRotationIntent(a, v(W), a, v(S))).toBe(0)
  })

  it('pure rigid rotation keeps midpoint, distance and facing errors; delta 0 would still normalize -PI', () => {
    const a = { position: { x: -0.2, y: 0.3 }, facing: 0.4 }
    const b = { position: { x: 0.1, y: -0.32 }, facing: -2.2 }
    const errA = grappleFacingError(a.position, a.facing, b.position)
    const errB = grappleFacingError(b.position, b.facing, a.position)
    const m = { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 }
    const d0 = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)
    rotateGrappledPair(a, b, 0.3)
    expect((a.position.x + b.position.x) / 2).toBeCloseTo(m.x, 14)
    expect((a.position.y + b.position.y) / 2).toBeCloseTo(m.y, 14)
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeCloseTo(d0, 14)
    expect(grappleFacingError(a.position, a.facing, b.position)).toBeCloseTo(errA, 12)
    expect(grappleFacingError(b.position, b.facing, a.position)).toBeCloseTo(errB, 12)
    // why step() skips the block for a zero intent: normalizeAngle maps exactly -PI to +PI
    const c = { position: { x: 0, y: 0 }, facing: -Math.PI }
    rotateGrappledPair(c, { position: { x: 1, y: 0 }, facing: 0 }, 0)
    expect(c.facing).toBe(Math.PI)
    expect(simulationSource).toMatch(/if \(rotation !== 0\) rotateGrappledPair\(a, b, rotation \* GRAPPLE_MANUAL_ROTATION_RATE \* TICK_SECONDS\)/)
  })

  it('B1: READY neutral, horizontal, the left wrestler presses W: + rotation, A up / B down, rigid', () => {
    const sim = horizontal()
    const s0 = sim.getSnapshot()
    sim.step(intents({ move: W }))
    const s1 = sim.getSnapshot()
    expectRigidStep(s0, s1, DELTA)
    expect(A(s1).position.y).toBeLessThan(A(s0).position.y)
    expect(B(s1).position.y).toBeGreaterThan(B(s0).position.y)
    expect(Math.abs(grappleFacingError(A(s1).position, A(s1).facing, B(s1).position))).toBeLessThan(1e-12)
    expect(Math.abs(grappleFacingError(B(s1).position, B(s1).facing, A(s1).position))).toBeLessThan(1e-12)
  })

  it('B2: diagonal W + D: the radial part is ignored, the rotation is 1/sqrt(2) of the maximum', () => {
    const sim = horizontal()
    const s0 = sim.getSnapshot()
    sim.step(intents({ move: [Math.SQRT1_2, -Math.SQRT1_2] }))
    expectRigidStep(s0, sim.getSnapshot(), Math.SQRT1_2 * DELTA)
  })

  it('B3: radial input (toward / away from the opponent) neither rotates, pushes nor pulls', () => {
    for (const move of [D, A_KEY]) {
      const sim = horizontal()
      const s0 = sim.getSnapshot()
      for (let k = 0; k < 30; k++) sim.step(intents({ move }))
      const s = sim.getSnapshot()
      expect(A(s).position).toEqual(A(s0).position)
      expect(B(s).position).toEqual(B(s0).position)
      expect(A(s).facing).toBe(A(s0).facing)
      expect(B(s).facing).toBe(B(s0).facing)
      expect(A(s).velocity).toEqual({ x: 0, y: 0 })
    }
  })

  it('B4: correct sign for pair axes 0 / 45 / 90 / 135 deg and every cardinal key (both wrestlers)', () => {
    for (const deg of [0, 45, 90, 135]) {
      const th = (deg * Math.PI) / 180
      const u = { x: Math.cos(th), y: Math.sin(th) }
      const a = { x: -u.x * BODY_RADIUS, y: -u.y * BODY_RADIUS }
      const b = { x: u.x * BODY_RADIUS, y: u.y * BODY_RADIUS }
      for (const key of [W, A_KEY, S, D]) {
        for (const who of ['a', 'b'] as const) {
          const sim = gripFrom(a, b)
          const s0 = sim.getSnapshot()
          sim.step(who === 'a' ? intents({ move: key }) : intents({}, { move: key }))
          const s1 = sim.getSnapshot()
          // the presser's own +angle orbit tangent: (-r.y, r.x) for r = presser - midpoint
          const self = who === 'a' ? A(s0) : B(s0)
          const m = midpoint(s0)
          const rx = self.position.x - m.x
          const ry = self.position.y - m.y
          const expected = (key[0] * -ry + key[1] * rx) / Math.hypot(rx, ry)
          expectRigidStep(s0, s1, expected * DELTA)
          // the presser itself moves along the pressed direction (never against it)
          const moved = who === 'a' ? A(s1) : B(s1)
          const along = (moved.position.x - self.position.x) * key[0] + (moved.position.y - self.position.y) * key[1]
          expect(along).toBeGreaterThanOrEqual(-1e-15)
        }
      }
    }
  })

  it('B5 / B6: same-sense requests clamp (no double speed); opposite requests cancel', () => {
    const same = horizontal()
    const s0 = same.getSnapshot()
    same.step(intents({ move: W }, { move: S })) // A up + B down = the same clockwise sense
    expectRigidStep(s0, same.getSnapshot(), DELTA)

    const opposite = horizontal()
    const o0 = opposite.getSnapshot()
    for (let k = 0; k < 30; k++) opposite.step(intents({ move: W }, { move: W }))
    const o = opposite.getSnapshot()
    expect(A(o).position).toEqual(A(o0).position)
    expect(B(o).position).toEqual(B(o0).position)
  })

  it('B7 / B8: while either is TURNING nobody rotates (orientation identical to no input); rotation starts on the first both-READY tick', () => {
    const withKeys = rearGrip()
    const plain = rearGrip()
    let turning = 0
    while (!bothReady(withKeys.getSnapshot())) {
      withKeys.step(intents({ move: W }, { move: D }))
      plain.step(IDLE)
      expect(withKeys.getSnapshot()).toEqual(plain.getSnapshot()) // B7: WASD ignored, auto-turn unchanged
      turning++
      expect(turning).toBeLessThan(200)
    }
    expect(turning).toBeGreaterThan(40)
    // B8: this tick begins with both READY -> the held WASD rotates now
    const s0 = withKeys.getSnapshot()
    withKeys.step(intents({ move: W }))
    const s1 = withKeys.getSnapshot()
    const m = midpoint(s0)
    const rx = A(s0).position.x - m.x
    const ry = A(s0).position.y - m.y
    const expected = (W[0] * -ry + W[1] * rx) / Math.hypot(rx, ry)
    expect(Math.abs(expected)).toBeGreaterThan(0.1)
    expect(wrap(axisAngle(s1) - axisAngle(s0))).toBeCloseTo(expected * DELTA, 12)
  })

  it('B9: WASD + Drive: rotation first, then Drive on the rotated axis with unchanged Drive values', () => {
    const both = horizontal()
    const driveOnly = horizontal()
    both.step(intents({ move: W, drive: true }))
    driveOnly.step(intents({ drive: true }))
    const s = both.getSnapshot()
    const d = driveOnly.getSnapshot()
    const ext = A(s).externalVelocity
    const speed = Math.hypot(ext.x, ext.y)
    expect(speed).toBeCloseTo(GRAPPLE_DRIVE_ACCELERATION * TICK_SECONDS, 12) // same Drive magnitude
    expect(speed).toBeCloseTo(Math.hypot(A(d).externalVelocity.x, A(d).externalVelocity.y), 12)
    expect(Math.atan2(ext.y, ext.x)).toBeCloseTo(DELTA, 12) // along the rotated A -> B axis, not the tick-start one
    expect(Math.atan2(A(d).externalVelocity.y, A(d).externalVelocity.x)).toBeCloseTo(0, 12)
    expect(B(s).externalVelocity).toEqual(ext)
    expect(dist(s)).toBeCloseTo(COMBINED, 12)
    // the pair keeps rotating while driving: the axis follows the footwork
    for (let k = 0; k < 59; k++) both.step(intents({ move: W, drive: true }))
    expect(axisAngle(both.getSnapshot())).toBeGreaterThan(30 * DELTA)
  })

  it('B10: Release + WASD on the same tick: release wins, no rotation; FREE movement / recovery as before', () => {
    const withKeys = horizontal()
    const plain = horizontal()
    withKeys.step(intents({ grip: true, move: W }, { move: S }))
    plain.step(intents({ grip: true }, { move: S }))
    const s = withKeys.getSnapshot()
    const p = plain.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(A(s).action).toMatchObject({ kind: 'grip', phase: 'recovery' })
    expect(A(s).position).toEqual(A(p).position) // the releaser in Grip recovery ignores WASD
    expect(B(s)).toEqual(B(p)) // B moves by ordinary FREE locomotion on the release tick, not by a pair rotation
    expect(B(s).velocity.y).toBeGreaterThan(0)
  })

  it('B11: near the edge the rotation can put exactly one wrestler out; existing ring-out decides', () => {
    const radius = 1
    const y0 = -0.93 // both inside: |(+-0.35, -0.93)| = 0.9937 < 1
    for (const [key, loser] of [
      [W, 'a'], // A rotates up and out (self ring-out)
      [S, 'b'], // A rotates down: B goes up and out (opponent ring-out)
    ] as const) {
      const sim = gripFrom({ x: -COMBINED / 2, y: y0 }, { x: COMBINED / 2, y: y0 }, radius)
      let ticks = 0
      while (sim.getSnapshot().outcome.kind === 'ongoing') {
        sim.step(intents({ move: key }))
        ticks++
        expect(ticks).toBeLessThan(120)
      }
      const out = sim.getSnapshot().outcome
      expect(out).toEqual({ kind: 'win', winnerId: loser === 'a' ? 'b' : 'a', loserId: loser, reason: 'ring-out' })
      const s = sim.getSnapshot()
      expect(Math.hypot(byId(s, loser).position.x, byId(s, loser).position.y)).toBeGreaterThan(radius)
      const winner = byId(s, loser === 'a' ? 'b' : 'a')
      expect(Math.hypot(winner.position.x, winner.position.y)).toBeLessThanOrEqual(radius)
    }
  })

  it('B12: a pure rotation cannot put both out at once (NOT APPLICABLE): at |A| = |B| = R one goes out, the other in', () => {
    // |A|^2 - |B|^2 = 4 m.r for A = m + r, B = m - r, so equal distances need r perpendicular to m; the rotation then
    // changes |A|^2 and |B|^2 by +-2 m.(dr) with opposite signs. Boundary case: both centers exactly ON the line
    // (still IN) with r perpendicular to m; one rotation tick each way ends with exactly one participant out.
    const radius = Math.hypot(0.9, BODY_RADIUS)
    for (const key of [W, S]) {
      const sim = gripFrom({ x: -COMBINED / 2, y: -0.9 }, { x: COMBINED / 2, y: -0.9 }, radius + 1e-9)
      // the grapple sits 1e-9 inside the line (r perpendicular to m) and one rotation tick decides
      sim.step(intents({ move: key }))
      const s = sim.getSnapshot()
      const outA = Math.hypot(A(s).position.x, A(s).position.y) > radius + 1e-9
      const outB = Math.hypot(B(s).position.x, B(s).position.y) > radius + 1e-9
      expect(outA !== outB).toBe(true)
      expect(s.outcome.kind).toBe('win')
    }
  })

  it('B13: Morozashi holder and disadvantaged have identical rotation authority (Drive factor is Drive-only)', () => {
    const holder = morozashi()
    const disadvantaged = morozashi()
    const h0 = holder.getSnapshot()
    holder.step(intents({ move: W })) // A (holder) on the left: + rotation
    disadvantaged.step(intents({}, { move: S })) // B (disadvantaged) on the right: the same + sense
    const h1 = holder.getSnapshot()
    const d1 = disadvantaged.getSnapshot()
    expectRigidStep(h0, h1, DELTA)
    expect(A(d1).position).toEqual(A(h1).position)
    expect(B(d1).position).toEqual(B(h1).position)
    expect(simulationSource).not.toMatch(/MOROZASHI_DRIVE_FACTOR[^\n]*ROTATION|ROTATION[^\n]*MOROZASHI_DRIVE_FACTOR/)
  })

  it('B14: zero / radial-only / cancelling WASD leaves every grappled tick identical to no input (Drive, orientation)', () => {
    // radial: along the actual current pair axis (toward / away), so it stays radial through TURNING and READY
    const toward = (s: BoutSnapshot): [number, number] => {
      const d = dist(s)
      return [(B(s).position.x - A(s).position.x) / d, (B(s).position.y - A(s).position.y) / d]
    }
    // exact: zero input and equal opposite senses (the intent is exactly 0, the block is skipped)
    const exact: ((s: BoutSnapshot) => [Input, Input])[] = [
      () => [{ move: [0, 0], drive: true }, { drive: true }],
      () => [{ move: W }, { move: W }],
      () => [{ move: [0.3, -0.8] }, { move: [0.3, -0.8] }],
    ]
    // a float-computed radial vector is radial up to roundoff (~1e-17 rad): same state within 1e-12
    const radial: ((s: BoutSnapshot) => [Input, Input])[] = [
      (s) => [{ move: toward(s), drive: true }, {}],
      (s) => [{}, { move: toward(s) }], // B pressing away from A
    ]
    for (const script of [...exact, ...radial]) {
      const keys = rearGrip()
      const plain = rearGrip()
      for (let k = 0; k < 120; k++) {
        const [ia, ib] = script(keys.getSnapshot())
        keys.step(intents(ia, ib))
        plain.step(intents({ drive: ia.drive }, { drive: ib.drive }))
        const s = keys.getSnapshot()
        const p = plain.getSnapshot()
        if (exact.includes(script)) {
          expect(s).toEqual(p)
        } else {
          for (const id of ['a', 'b'] as const) {
            expect(byId(s, id).position.x).toBeCloseTo(byId(p, id).position.x, 12)
            expect(byId(s, id).position.y).toBeCloseTo(byId(p, id).position.y, 12)
            expect(wrap(byId(s, id).facing - byId(p, id).facing)).toBeCloseTo(0, 12)
            expect(byId(s, id).externalVelocity.x).toBeCloseTo(byId(p, id).externalVelocity.x, 12)
            expect(byId(s, id).externalVelocity.y).toBeCloseTo(byId(p, id).externalVelocity.y, 12)
          }
        }
      }
      expect(bothReady(keys.getSnapshot())).toBe(true) // the comparison covered READY ticks too
    }
  })

  it('B15: fixed-step determinism: the same script replays identically (no render delta anywhere)', () => {
    const run = () => {
      const sim = horizontal()
      const script: [number, Input, Input][] = [
        [40, { move: W }, {}],
        [30, { move: [Math.SQRT1_2, Math.SQRT1_2], drive: true }, { move: A_KEY }],
        [20, {}, { move: S, drive: true }],
        [1, { grip: true, move: W }, {}],
        [10, { move: D }, {}],
      ]
      for (const [n, ia, ib] of script) for (let k = 0; k < n; k++) sim.step(intents(ia, ib))
      return sim.getSnapshot()
    }
    expect(run()).toEqual(run())
    expect(simulationSource).toMatch(/step\(intents: ReadonlyMap<ParticipantId, ParticipantIntent>\): void/)
  })

  it('B16: swapping the participant order gives the same physical result', () => {
    const normal = horizontal(false)
    const swapped = horizontal(true)
    const script: [Input, Input][] = [
      [{ move: W }, {}],
      [{}, { move: S }],
      [{ move: [Math.SQRT1_2, -Math.SQRT1_2], drive: true }, { move: A_KEY }],
    ]
    for (const [ia, ib] of script) {
      for (let k = 0; k < 20; k++) {
        normal.step(intents(ia, ib))
        swapped.step(intents(ia, ib))
        const n = normal.getSnapshot()
        const s = swapped.getSnapshot()
        for (const id of ['a', 'b'] as const) {
          expect(byId(s, id).position.x).toBeCloseTo(byId(n, id).position.x, 12)
          expect(byId(s, id).position.y).toBeCloseTo(byId(n, id).position.y, 12)
          expect(wrap(byId(s, id).facing - byId(n, id).facing)).toBeCloseTo(0, 12)
        }
      }
    }
  })

  it('B17: sustained rotation keeps the midpoint, the 0.70 m bond and READY; finite throughout', () => {
    const sim = horizontal()
    const m0 = midpoint(sim.getSnapshot())
    for (let k = 0; k < 600; k++) {
      sim.step(intents({ move: k % 200 < 100 ? W : S }, { move: k % 300 < 150 ? D : W }))
      const s = sim.getSnapshot()
      expect(dist(s)).toBeCloseTo(COMBINED, 9)
      expect(Math.hypot(midpoint(s).x - m0.x, midpoint(s).y - m0.y)).toBeLessThan(1e-12)
      expect(Math.abs(grappleFacingError(A(s).position, A(s).facing, B(s).position))).toBeLessThanOrEqual(GRAPPLE_FACING_TOLERANCE)
      expect(Math.abs(grappleFacingError(B(s).position, B(s).facing, A(s).position))).toBeLessThanOrEqual(GRAPPLE_FACING_TOLERANCE)
      for (const p of s.participants) expect(Number.isFinite(p.position.x + p.position.y + p.facing)).toBe(true)
    }
  })

  it('B18: holding one direction slows to a natural stop where it becomes radial, without overshoot', () => {
    const sim = horizontal()
    let previousStep = Infinity
    let angle = axisAngle(sim.getSnapshot())
    for (let k = 0; k < 400; k++) {
      sim.step(intents({ move: W }))
      const next = axisAngle(sim.getSnapshot())
      const stepSize = next - angle
      expect(stepSize).toBeGreaterThanOrEqual(0) // never reverses
      expect(stepSize).toBeLessThanOrEqual(previousStep + 1e-15) // never speeds up
      expect(next).toBeLessThanOrEqual(Math.PI / 2 + 1e-12) // never passes "A directly above B"
      previousStep = stepSize
      angle = next
    }
    expect(angle).toBeCloseTo(Math.PI / 2, 3) // A ends above B: W is now radial
  })

  it('B19: the grappled dummy (move 0, Drive held) never rotates the pair', () => {
    const sim = horizontal()
    const dummy = new PushDummyController('b', 'a')
    dummy.setMode('push')
    const a0 = axisAngle(sim.getSnapshot())
    for (let k = 0; k < 120; k++) {
      const s = sim.getSnapshot()
      const intent = dummy.nextIntent(s)
      expect(intent.move).toEqual({ x: 0, y: 0 })
      sim.step(new Map([['a', one({})], ['b', intent]]))
      if (sim.getSnapshot().outcome.kind !== 'ongoing') break
      expect(axisAngle(sim.getSnapshot())).toBeCloseTo(a0, 12)
    }
  })
})
