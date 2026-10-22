import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  EXTERNAL_DECELERATION,
  GRAPPLE_DRIVE_ACCELERATION,
  GRAPPLE_DRIVE_SPEED,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  MAX_EXTERNAL_SPEED,
  MOROZASHI_DRIVE_FACTOR,
  PUSH_STARTUP_TICKS,
  TICK_SECONDS,
  grappleDriveStrength,
  grappledExternalVelocity,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'
import { DUMMY_PUSH_COOLDOWN_TICKS, PushDummyController } from '../input/pushDummyController.ts'
import { canActInGrapple, grappleFacingError } from './grappleOrientation.ts'

const COMBINED = 2 * BODY_RADIUS
const DRIVE_STEP = GRAPPLE_DRIVE_ACCELERATION * TICK_SECONDS
const DECAY_STEP = EXTERNAL_DECELERATION * TICK_SECONDS

function setupAt(ax: number, ay: number, bx: number, by: number, radius = 100): BoutSetup {
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
  tsuppariLeftPressed: false,
  tsuppariRightPressed: false,
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
const dist = (s: BoutSnapshot) =>
  Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const ready = (s: BoutSnapshot, which: 0 | 1) =>
  canActInGrapple(s.participants[which], s.participants[1 - which], s.engagement)
const errorOf = (self: ParticipantState, other: ParticipantState) =>
  Math.abs(grappleFacingError(self.position, self.facing, other.position))

// ACTION-11C: a Grip pressed in contact lands on reach elapsed GRIP_MIN_ATTEMPT_TICKS (the press tick is 0).
function pressGrip(sim: BoutSimulation): void {
  sim.step(intents({ grip: true }))
  stepN(sim, GRIP_MIN_ATTEMPT_TICKS)
}

function stepN(sim: BoutSimulation, n: number, i = IDLE): void {
  for (let k = 0; k < n; k++) sim.step(i)
}

function expectFinite(s: BoutSnapshot): void {
  for (const p of s.participants) {
    for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.externalVelocity.x, p.externalVelocity.y, p.facing]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  }
}

// Frontal neutral grapple (both READY), pair on the x axis, A on the left.
function frontGrip(radius = 100): BoutSimulation {
  const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0, radius))
  pressGrip(sim)
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  return sim
}

// Frontal Morozashi (holder a): B fails a Counter facing A, then A grips.
function frontMorozashi(): BoutSimulation {
  const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({}, { counter: t === 0 }))
  pressGrip(sim)
  const s = sim.getSnapshot()
  expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  expect(ready(s, 0) && ready(s, 1)).toBe(true)
  return sim
}

// Best Counter -> rear (after the Counter transition) -> Grip: A holds Morozashi and is READY, B is TURNING.
function rearMorozashi(): BoutSimulation {
  const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
  for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
  stepN(sim, COUNTER_TRANSITION_TICKS)
  pressGrip(sim)
  const s = sim.getSnapshot()
  expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  expect(ready(s, 0)).toBe(true)
  expect(ready(s, 1)).toBe(false)
  return sim
}

describe('Grappled Drive (ACTION-05C1)', () => {
  it('T131: FREE ignores driveHeld; the Push edge behaves exactly as before', () => {
    const held = new BoutSimulation(setupAt(-2, 0, 2, 0))
    const plain = new BoutSimulation(setupAt(-2, 0, 2, 0))
    for (let t = 0; t < 60; t++) {
      held.step(intents({ drive: true, push: t === 3, move: [1, 0] }, { drive: true }))
      plain.step(intents({ push: t === 3, move: [1, 0] }))
      expect(A(held.getSnapshot()).action.kind).not.toBe('drive')
    }
    expect(held.getSnapshot()).toEqual(plain.getSnapshot())
  })

  it('T132 / T139: one-sided neutral Drive accelerates the pair to 0.6 m/s at 4 m/s^2 (no decay stall)', () => {
    const sim = frontGrip()
    const x0 = B(sim.getSnapshot()).position.x
    let prev = 0
    for (let k = 1; k <= 40; k++) {
      sim.step(intents({ drive: true }))
      const s = sim.getSnapshot()
      expect(A(s).action).toEqual({ kind: 'drive' })
      expect(B(s).action).toEqual({ kind: 'idle' })
      const v = A(s).externalVelocity.x
      expect(v).toBeCloseTo(Math.min(GRAPPLE_DRIVE_SPEED, k * DRIVE_STEP), 12)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(B(s).externalVelocity).toEqual(A(s).externalVelocity)
      expect(A(s).externalVelocity.y).toBeCloseTo(0, 12)
      expect(dist(s)).toBeCloseTo(COMBINED, 12)
      prev = v
    }
    expect(prev).toBeCloseTo(GRAPPLE_DRIVE_SPEED, 12)
    expect(B(sim.getSnapshot()).position.x - x0).toBeGreaterThan(0.3) // B was driven back
  })

  it('T133: B driving alone mirrors A exactly', () => {
    const a = frontGrip()
    const b = frontGrip()
    for (let k = 0; k < 30; k++) {
      a.step(intents({ drive: true }))
      b.step(intents({}, { drive: true }))
      const sa = a.getSnapshot()
      const sb = b.getSnapshot()
      expect(B(sb).action).toEqual({ kind: 'drive' })
      expect(A(sb).externalVelocity.x).toBeCloseTo(-A(sa).externalVelocity.x, 12)
      expect(A(sb).position.x).toBeCloseTo(-B(sa).position.x, 12)
      expect(B(sb).position.x).toBeCloseTo(-A(sa).position.x, 12)
    }
  })

  it('T134: a TURNING participant holding Drive contributes nothing; the READY one drives unopposed', () => {
    const sim = rearMorozashi()
    sim.step(intents({ drive: true }, { drive: true }))
    const s = sim.getSnapshot()
    expect(B(s).action).toEqual({ kind: 'idle' })
    expect(A(s).action).toEqual({ kind: 'drive' })
    const d = { x: B(s).position.x - A(s).position.x, y: B(s).position.y - A(s).position.y }
    const along = (A(s).externalVelocity.x * d.x + A(s).externalVelocity.y * d.y) / Math.hypot(d.x, d.y)
    expect(along).toBeGreaterThan(0) // pushing B away from A
  })

  it('T135: Drive held while TURNING starts contributing on the first tick that begins READY', () => {
    const sim = rearMorozashi()
    let started = -1
    for (let t = 0; t < 100 && started < 0; t++) {
      const wasReady = ready(sim.getSnapshot(), 1)
      sim.step(intents({}, { drive: true }))
      const driving = B(sim.getSnapshot()).action.kind === 'drive'
      expect(driving).toBe(wasReady)
      if (driving) started = t
    }
    expect(started).toBeGreaterThan(40) // the rear opening (about 55 turn updates)
  })

  it('T136: equal neutral contest adds nothing; existing pair momentum decays instead of being zeroed', () => {
    const still = frontGrip()
    for (let k = 0; k < 60; k++) {
      still.step(intents({ drive: true }, { drive: true }))
      const s = still.getSnapshot()
      expect(A(s).action.kind).toBe('drive')
      expect(B(s).action.kind).toBe('drive')
      expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(s).position.x).toBeCloseTo(-COMBINED / 2, 12)
    }
    const moving = frontGrip()
    stepN(moving, 20, intents({ drive: true }))
    let v = A(moving.getSnapshot()).externalVelocity.x
    expect(v).toBeCloseTo(GRAPPLE_DRIVE_SPEED, 12)
    for (let k = 0; k < 10; k++) {
      moving.step(intents({ drive: true }, { drive: true }))
      const next = A(moving.getSnapshot()).externalVelocity.x
      expect(next).toBeCloseTo(Math.max(0, v - DECAY_STEP), 12)
      v = next
    }
    expect(v).toBe(0)
  })

  it('T137: a Morozashi holder alone drives 1.5x faster and harder than neutral', () => {
    const sim = frontMorozashi()
    for (let k = 1; k <= 30; k++) {
      sim.step(intents({ drive: true }))
      expect(A(sim.getSnapshot()).externalVelocity.x).toBeCloseTo(
        Math.min(GRAPPLE_DRIVE_SPEED * MOROZASHI_DRIVE_FACTOR, k * DRIVE_STEP * MOROZASHI_DRIVE_FACTOR),
        12,
      )
    }
    expect(grappleDriveStrength(sim.getSnapshot().engagement, 'a')).toBe(1.5)
    expect(grappleDriveStrength(sim.getSnapshot().engagement, 'b')).toBe(1)
  })

  it('T138: holder vs disadvantaged contest nets 0.5 in the holder Drive direction', () => {
    const sim = frontMorozashi()
    for (let k = 1; k <= 40; k++) {
      sim.step(intents({ drive: true }, { drive: true }))
      const s = sim.getSnapshot()
      expect(A(s).action.kind).toBe('drive')
      expect(B(s).action.kind).toBe('drive')
      expect(A(s).externalVelocity.x).toBeCloseTo(Math.min(GRAPPLE_DRIVE_SPEED * 0.5, k * DRIVE_STEP * 0.5), 12)
    }
  })

  it('T139: the shared update helper reaches the target despite EXTERNAL_DECELERATION > acceleration', () => {
    expect(EXTERNAL_DECELERATION).toBeGreaterThan(GRAPPLE_DRIVE_ACCELERATION)
    let v = { x: 0, y: 0 }
    for (let k = 1; k <= 9; k++) {
      v = grappledExternalVelocity(v, { x: 1, y: 0 }, 1)
      expect(v.x).toBeCloseTo(Math.min(GRAPPLE_DRIVE_SPEED, k * DRIVE_STEP), 12)
    }
    // overspeed in the Drive direction bleeds back by the existing decay, not below the target
    const fast = grappledExternalVelocity({ x: 0.7, y: 0 }, { x: 1, y: 0 }, 1)
    expect(fast.x).toBeCloseTo(Math.max(GRAPPLE_DRIVE_SPEED, 0.7 - DECAY_STEP), 12)
    expect(grappledExternalVelocity({ x: 5, y: 0 }, { x: 1, y: 0 }, 1).x).toBeLessThanOrEqual(MAX_EXTERNAL_SPEED)
  })

  it('T140: opposite momentum is cancelled by the Drive and then reversed, without passing the target', () => {
    let v = { x: -0.5, y: 0 }
    const seen: number[] = []
    for (let k = 0; k < 40; k++) {
      v = grappledExternalVelocity(v, { x: 1, y: 0 }, 1)
      seen.push(v.x)
    }
    expect(seen[0]).toBeCloseTo(-0.5 + DRIVE_STEP, 12)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
    expect(Math.max(...seen)).toBeCloseTo(GRAPPLE_DRIVE_SPEED, 12)

    // integration: A drives, then B takes over -> the pair reverses deterministically
    const sim = frontGrip()
    stepN(sim, 20, intents({ drive: true }))
    let prev = A(sim.getSnapshot()).externalVelocity.x
    for (let k = 0; k < 40; k++) {
      sim.step(intents({}, { drive: true }))
      const x = A(sim.getSnapshot()).externalVelocity.x
      expect(x).toBeCloseTo(Math.max(-GRAPPLE_DRIVE_SPEED, prev - DRIVE_STEP), 12)
      prev = x
    }
    expect(prev).toBeCloseTo(-GRAPPLE_DRIVE_SPEED, 12)
  })

  it('T141: perpendicular momentum decays while the axial Drive continues', () => {
    const v = grappledExternalVelocity({ x: 0, y: 0.5 }, { x: 1, y: 0 }, 1)
    expect(v.x).toBeCloseTo(DRIVE_STEP, 12)
    expect(v.y).toBeCloseTo(0.5 - DECAY_STEP, 12)
    const gone = grappledExternalVelocity({ x: 0, y: 0.05 }, { x: 1, y: 0 }, 1)
    expect(gone.y).toBe(0)
  })

  it('T142: READY release during Drive wins: FREE, no Drive left, momentum kept then FREE decay', () => {
    const sim = frontGrip()
    stepN(sim, 20, intents({ drive: true }, { drive: true }))
    stepN(sim, 1, intents({ drive: true }))
    const before = sim.getSnapshot()
    const v0 = A(before).externalVelocity.x
    expect(v0).toBeCloseTo(DRIVE_STEP, 12)
    sim.step(intents({ drive: true, grip: true }, { drive: true }))
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(A(s).action).toMatchObject({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS - 1 })
    expect(B(s).action).toEqual({ kind: 'idle' })
    expect(A(s).externalVelocity.x).toBeCloseTo(Math.max(0, v0 - DECAY_STEP), 12) // FREE decay, no Drive gain
    for (let k = 0; k < 30; k++) {
      sim.step(intents({ drive: true }, { drive: true }))
      for (const p of sim.getSnapshot().participants) expect(p.action.kind).not.toBe('drive')
    }
  })

  it('T143: a TURNING participant holding Drive cannot release either', () => {
    const sim = rearMorozashi()
    for (let k = 0; k < 10; k++) {
      sim.step(intents({}, { drive: true, grip: true }))
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('grappled')
      expect(B(s).action).toEqual({ kind: 'idle' })
    }
  })

  it('T144: Drive keeps the bond distance and pair axis; TURNING continues at the usual rate', () => {
    const sim = rearMorozashi()
    const s0 = sim.getSnapshot()
    const axis = { x: B(s0).position.x - A(s0).position.x, y: B(s0).position.y - A(s0).position.y }
    let prevError = errorOf(B(s0), A(s0))
    for (let k = 0; k < 70; k++) {
      sim.step(intents({ drive: true }, { drive: true }))
      const s = sim.getSnapshot()
      expectFinite(s)
      expect(dist(s)).toBeCloseTo(COMBINED, 12)
      expect(B(s).position.x - A(s).position.x).toBeCloseTo(axis.x, 12)
      expect(B(s).position.y - A(s).position.y).toBeCloseTo(axis.y, 12)
      const e = errorOf(B(s), A(s))
      expect(e).toBeLessThanOrEqual(prevError + 1e-12)
      prevError = e
    }
    expect(prevError).toBe(0)
  })

  it('T145: letting go of ArrowUp ends Drive at once; momentum decays by the existing rule', () => {
    const sim = frontGrip()
    stepN(sim, 20, intents({ drive: true }))
    let v = A(sim.getSnapshot()).externalVelocity.x
    for (let k = 0; k < 8; k++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expect(A(s).action).toEqual({ kind: 'idle' })
      expect(A(s).externalVelocity.x).toBeCloseTo(Math.max(0, v - DECAY_STEP), 12)
      v = A(s).externalVelocity.x
    }
    expect(v).toBe(0)
  })

  it('T146: Dummy Mode 2 holds Drive while grappled; the Simulation gates it by readiness', () => {
    // Frontal: the player grips the dummy (ACTION-11C: lands after the minimum attempt), which pushes back from the
    // first grappled tick. The dummy is switched to Mode 2 only once grappled: a FREE Mode 2 dummy in contact would
    // Push, and its impact defeats the reaching Grip (ACTION-11C Push > Grip).
    const sim = new BoutSimulation(setupAt(-COMBINED / 2 - 0.025, 0, COMBINED / 2 + 0.025, 0))
    const dummy = new PushDummyController('b', 'a')
    let grappledTicks = 0
    for (let t = 0; t < 30; t++) {
      const before = sim.getSnapshot()
      if (before.engagement.kind === 'grappled' && dummy.getMode() !== 'push') dummy.setMode('push')
      const intent = dummy.nextIntent(before)
      if (before.engagement.kind === 'grappled') {
        expect(intent).toEqual({ ...one({}), driveHeld: true })
        grappledTicks++
      }
      sim.step(new Map([['a', one({ grip: t === 0 })], ['b', intent]]))
    }
    // the 0.05 m gap is closed by the lunge: the grapple starts inside the reach, no earlier than the minimum attempt
    expect(grappledTicks).toBeLessThanOrEqual(30 - 1 - GRIP_MIN_ATTEMPT_TICKS)
    expect(grappledTicks).toBeGreaterThanOrEqual(30 - GRIP_REACH_TICKS)
    expect(B(sim.getSnapshot()).action.kind).toBe('drive')
    expect(A(sim.getSnapshot()).externalVelocity.x).toBeCloseTo(-GRAPPLE_DRIVE_SPEED, 12)

    // Rear Morozashi: the TURNING dummy holds Drive but only contributes once READY.
    const rear = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    const d2 = new PushDummyController('b', 'a')
    d2.setMode('push') // in contact and ready: pushes on tick 0
    let firstDummyDrive = -1
    let playerAlone = false
    const gripTick = PUSH_STARTUP_TICKS + 1 + COUNTER_TRANSITION_TICKS // after the Counter transition
    for (let t = 0; t < 150 + COUNTER_TRANSITION_TICKS; t++) {
      const before = rear.getSnapshot()
      const intent = d2.nextIntent(before)
      const player = one({ counter: t === 0, grip: t === gripTick, drive: t > gripTick })
      rear.step(new Map([['a', player], ['b', intent]]))
      const s = rear.getSnapshot()
      if (s.engagement.kind === 'grappled' && A(s).action.kind === 'drive' && B(s).action.kind === 'idle') playerAlone = true
      if (firstDummyDrive < 0 && B(s).action.kind === 'drive') {
        firstDummyDrive = t
        expect(ready(before, 1)).toBe(true)
      }
    }
    expect(playerAlone).toBe(true)
    expect(firstDummyDrive).toBeGreaterThan(gripTick + 40)
    expect(rear.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(DUMMY_PUSH_COOLDOWN_TICKS).toBe(30)
  })

  it('T147: contests are order-independent (swapped participant order gives the same pair motion)', () => {
    const swapped = new BoutSimulation({
      arena: { radius: 100 },
      participants: [
        { id: 'b', position: { x: COMBINED / 2, y: 0 } },
        { id: 'a', position: { x: -COMBINED / 2, y: 0 } },
      ],
    })
    pressGrip(swapped)
    const normal = frontGrip()
    for (let k = 0; k < 40; k++) {
      const i = intents({ drive: true }, { drive: k > 20 })
      normal.step(i)
      swapped.step(i)
      const n = normal.getSnapshot()
      const w = swapped.getSnapshot()
      expect(w.participants[1].position.x).toBeCloseTo(A(n).position.x, 12) // 'a'
      expect(w.participants[0].position.x).toBeCloseTo(B(n).position.x, 12) // 'b'
      expect(w.participants[0].externalVelocity.x).toBeCloseTo(A(n).externalVelocity.x, 12)
    }
  })

  // ACTION-06A replaced the 05C1 "no Ring-out" expectation: driving past the ring now ends the bout.
  it('T148: driving the pair past the ring ends the bout by ring-out; no clamp or wall', () => {
    const sim = frontGrip(2.275)
    stepN(sim, 400, intents({ drive: true }))
    const s = sim.getSnapshot()
    expect(s.outcome).toEqual({ kind: 'win', winnerId: 'a', loserId: 'b', reason: 'ring-out' })
    expect(Math.hypot(B(s).position.x, B(s).position.y)).toBeGreaterThan(2.275) // not clamped back
    expect(Math.hypot(A(s).position.x, A(s).position.y)).toBeLessThanOrEqual(2.275)
    expect(s.engagement.kind).toBe('grappled') // final physical state kept as-is
    expect(Object.keys(s).sort()).toEqual(['arena', 'counterTransition', 'engagement', 'outcome', 'participants'])
  })

  it('T150: Counter -> Kuzushi -> Morozashi -> TURNING -> Drive -> contest -> release replays exactly', () => {
    const run = () => {
      const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0.02, COMBINED / 2, 0))
      const script: [number, Input, Input][] = [
        [1, { counter: true }, { push: true }],
        [PUSH_STARTUP_TICKS, {}, {}],
        [COUNTER_TRANSITION_TICKS, {}, {}],
        [1, { grip: true }, {}],
        [30, { drive: true }, { drive: true }],
        [40, { drive: true }, { drive: true, grip: true }],
        [20, {}, { drive: true }],
        [1, { grip: true }, {}],
        [30, { move: [1, 0], drive: true }, { drive: true }],
      ]
      for (const [n, ia, ib] of script) {
        for (let k = 0; k < n; k++) {
          sim.step(intents(ia, ib))
          const s = sim.getSnapshot()
          expectFinite(s)
          if (s.engagement.kind === 'grappled') {
            expect(dist(s)).toBeCloseTo(COMBINED, 9)
            expect(A(s).externalVelocity).toEqual(B(s).externalVelocity)
            for (const p of s.participants) expect(['idle', 'drive']).toContain(p.action.kind)
          } else {
            for (const p of s.participants) expect(p.action.kind).not.toBe('drive')
          }
        }
      }
      return sim.getSnapshot()
    }
    expect(run()).toEqual(run())
  })
})
