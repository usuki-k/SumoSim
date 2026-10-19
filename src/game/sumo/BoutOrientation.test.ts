import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, GRIP_RECOVERY_TICKS, PUSH_STARTUP_TICKS, TICK_SECONDS } from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'
import {
  GRAPPLE_FACING_TOLERANCE,
  GRAPPLE_TURN_RATE,
  canActInGrapple,
  grappleFacingError,
  isGrappleReady,
  normalizeAngle,
  turnFacingTowardGrapple,
} from './grappleOrientation.ts'
import grappleOrientationSource from './grappleOrientation.ts?raw'

const COMBINED = 2 * BODY_RADIUS
const STEP = GRAPPLE_TURN_RATE * TICK_SECONDS

function setupAt(ax: number, ay: number, bx: number, by: number): BoutSetup {
  return {
    arena: { radius: 100 },
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
}

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  const one = (i: Input): ParticipantIntent => ({
    move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
    pushPressed: i.push ?? false,
    counterPressed: i.counter ?? false,
    gripPressed: i.grip ?? false,
  })
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
const errorOf = (self: ParticipantState, other: ParticipantState) =>
  grappleFacingError(self.position, self.facing, other.position)
const ready = (s: BoutSnapshot, which: 0 | 1) =>
  canActInGrapple(s.participants[which], s.participants[1 - which], s.engagement)

// B pushes on tick 0; A counters (Best on tick 0 -> rear, or Success later -> side) and grips the
// Kuzushi B on the next tick. Returns the simulation right after the grip tick.
function counterGrip(kind: 'side' | 'rear'): BoutSimulation {
  const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
  const counterTick = kind === 'rear' ? 0 : PUSH_STARTUP_TICKS + 4
  const resolveTick = kind === 'rear' ? PUSH_STARTUP_TICKS : counterTick
  for (let t = 0; t <= resolveTick; t++) sim.step(intents({ counter: t === counterTick }, { push: t === 0 }))
  expect(B(sim.getSnapshot()).posture.kind).toBe('kuzushi')
  sim.step(intents({ grip: true }))
  const s = sim.getSnapshot()
  expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  return sim
}

// Number of end-of-tick turn updates (the grip tick's included) until B is READY.
function turnUpdatesUntilReady(sim: BoutSimulation): number {
  let updates = 1
  while (!ready(sim.getSnapshot(), 1)) {
    sim.step(IDLE)
    updates++
    expect(updates).toBeLessThan(200)
  }
  return updates
}

function frontGrip(): BoutSimulation {
  const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
  sim.step(intents({ grip: true }))
  expect(sim.getSnapshot().engagement.kind).toBe('grappled')
  return sim
}

describe('Grappled orientation readiness (ACTION-05B1)', () => {
  it('T115: normalizeAngle wraps into (-PI, PI] and maps -PI to +PI', () => {
    expect(normalizeAngle(-Math.PI)).toBe(Math.PI)
    expect(normalizeAngle(Math.PI)).toBe(Math.PI)
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12)
    expect(normalizeAngle(0)).toBe(0)
    for (const a of [-100, -7, -3.2, -1, 0.5, 3.1, 6.3, 42, 1e6]) {
      const r = normalizeAngle(a)
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThan(-Math.PI)
      expect(r).toBeLessThanOrEqual(Math.PI)
      expect(Math.cos(r)).toBeCloseTo(Math.cos(a), 6)
      expect(Math.sin(r)).toBeCloseTo(Math.sin(a), 6)
    }
  })

  it('T116: a frontal Grip leaves both participants READY at once; release works the next tick', () => {
    const sim = frontGrip()
    const s = sim.getSnapshot()
    expect(ready(s, 0)).toBe(true)
    expect(ready(s, 1)).toBe(true)
    sim.step(intents({ grip: true }))
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'free' })
  })

  it('T117: side Counter -> Grip: gripper READY, target TURNING with no snap, exact fixed-rate progression', () => {
    const sim = counterGrip('side')
    let s = sim.getSnapshot()
    expect(ready(s, 0)).toBe(true)
    expect(ready(s, 1)).toBe(false)
    const e1 = Math.abs(errorOf(B(s), A(s)))
    expect(e1).toBeCloseTo(Math.PI / 2 - STEP, 1) // ~90 deg minus the grip tick's own turn
    // every following update reduces the error by exactly one step until it snaps
    let prev = e1
    let updates = 1
    while (!ready(s, 1)) {
      sim.step(IDLE)
      s = sim.getSnapshot()
      updates++
      const e = Math.abs(errorOf(B(s), A(s)))
      if (prev > STEP) expect(e).toBeCloseTo(prev - STEP, 9)
      prev = e
    }
    expect(updates).toBe(Math.ceil((e1 - GRAPPLE_FACING_TOLERANCE) / STEP - 1e-9) + 1)
    expect(updates).toBeGreaterThanOrEqual(24)
    expect(updates).toBeLessThanOrEqual(26)
  })

  it('T118: rear Counter -> Grip: target TURNING roughly 55 updates, longer than side', () => {
    const rear = counterGrip('rear')
    const s = rear.getSnapshot()
    expect(ready(s, 0)).toBe(true)
    expect(ready(s, 1)).toBe(false)
    expect(Math.abs(errorOf(B(s), A(s)))).toBeCloseTo(Math.PI - STEP, 1)
    const rearUpdates = turnUpdatesUntilReady(rear)
    const sideUpdates = turnUpdatesUntilReady(counterGrip('side'))
    expect(rearUpdates).toBeGreaterThanOrEqual(54)
    expect(rearUpdates).toBeLessThanOrEqual(56)
    expect(rearUpdates).toBeGreaterThan(sideUpdates + 25)
  })

  it('T119: shortest-path turning in both signs; an exact rear tie turns in the fixed + direction', () => {
    const o = { x: 0, y: 0 }
    expect(turnFacingTowardGrapple(o, 0, { x: Math.cos(1), y: Math.sin(1) }, STEP)).toBeCloseTo(STEP, 12)
    expect(turnFacingTowardGrapple(o, 0, { x: Math.cos(-1), y: Math.sin(-1) }, STEP)).toBeCloseTo(-STEP, 12)
    // crossing the +-PI seam takes the short way
    expect(turnFacingTowardGrapple(o, 3, { x: Math.cos(-3), y: Math.sin(-3) }, STEP)).toBeCloseTo(3 + STEP, 12)
    // exact tie (error = PI) and float-noise ties on either side of the seam all turn +
    expect(turnFacingTowardGrapple(o, 0, { x: -1, y: 0 }, STEP)).toBeCloseTo(STEP, 12)
    expect(turnFacingTowardGrapple(o, 0, { x: -1, y: 1e-12 }, STEP)).toBeCloseTo(STEP, 12)
    expect(turnFacingTowardGrapple(o, 0, { x: -1, y: -1e-12 }, STEP)).toBeCloseTo(STEP, 12)
    // integration: the rear victim turns + on its first update
    const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
    const before = B(sim.getSnapshot()).facing
    sim.step(intents({ grip: true }))
    expect(normalizeAngle(B(sim.getSnapshot()).facing - before)).toBeCloseTo(STEP, 9)
  })

  it('T120: per-tick change is at most one step, never overshoots, and finally snaps onto the bearing', () => {
    const sim = counterGrip('rear')
    let s = sim.getSnapshot()
    for (let k = 0; k < 80; k++) {
      const f0 = B(s).facing
      sim.step(IDLE)
      s = sim.getSnapshot()
      expect(Number.isFinite(B(s).facing)).toBe(true)
      expect(Math.abs(normalizeAngle(B(s).facing - f0))).toBeLessThanOrEqual(STEP + 1e-12)
      expect(Math.abs(errorOf(B(s), A(s)))).toBeLessThan(Math.PI) // never wraps past the target
    }
    const bearing = Math.atan2(A(s).position.y - B(s).position.y, A(s).position.x - B(s).position.x)
    expect(B(s).facing).toBe(bearing)
    expect(errorOf(B(s), A(s))).toBe(0)
  })

  it('T121: the tolerance boundary is inclusive', () => {
    const o = { x: 0, y: 0 }
    const east = { x: 1, y: 0 }
    expect(isGrappleReady(o, -GRAPPLE_FACING_TOLERANCE, east)).toBe(true)
    expect(isGrappleReady(o, GRAPPLE_FACING_TOLERANCE, east)).toBe(true)
    expect(isGrappleReady(o, -GRAPPLE_FACING_TOLERANCE - 1e-9, east)).toBe(false)
    expect(isGrappleReady(o, GRAPPLE_FACING_TOLERANCE + 1e-9, east)).toBe(false)
    expect(isGrappleReady(o, 2, o)).toBe(true) // coincident centers: undefined bearing -> READY
    expect(GRAPPLE_FACING_TOLERANCE).toBe(Math.PI / 12)
    expect(GRAPPLE_TURN_RATE).toBe(Math.PI)
  })

  it('T122: a participant entering tolerance at the end of tick t may act only from tick t+1', () => {
    const probe = counterGrip('rear')
    let t = 0
    while (!ready(probe.getSnapshot(), 1)) {
      probe.step(IDLE)
      t++
    }
    // the tick `t` (counted after the grip tick) is the one whose end first shows READY
    const run = (pressAt: number) => {
      const sim = counterGrip('rear')
      for (let k = 1; k <= pressAt; k++) sim.step(intents({}, { grip: k === pressAt }))
      return sim.getSnapshot()
    }
    const sameTick = run(t)
    expect(ready(sameTick, 1)).toBe(true)
    expect(sameTick.engagement.kind).toBe('grappled') // was TURNING at the start of tick t
    expect(run(t + 1).engagement).toEqual({ kind: 'free' })
  })

  it('T123: Shift while TURNING is ignored: no release, no Recovery, nothing queued', () => {
    const sim = counterGrip('rear')
    for (let k = 0; k < 20; k++) {
      sim.step(intents({}, { grip: true }))
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('grappled')
      expect(B(s).action).toEqual({ kind: 'idle' })
    }
    while (!ready(sim.getSnapshot(), 1)) sim.step(IDLE)
    for (let k = 0; k < 10; k++) sim.step(IDLE)
    expect(sim.getSnapshot().engagement.kind).toBe('grappled') // no delayed release
  })

  it('T124: READY release keeps ACTION-05A semantics (one-sided and simultaneous)', () => {
    const one = frontGrip()
    one.step(intents({}, { grip: true }))
    let s = one.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(B(s).action).toEqual({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS - 1 })
    expect(A(s).action).toEqual({ kind: 'idle' })

    const both = frontGrip()
    both.step(intents({ grip: true }, { grip: true }))
    s = both.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(A(s).action).toEqual(B(s).action)
    expect(A(s).action.kind).toBe('grip')
  })

  it('T125: READY + TURNING both press: only the READY participant releases', () => {
    const sim = counterGrip('side')
    expect(ready(sim.getSnapshot(), 0)).toBe(true)
    expect(ready(sim.getSnapshot(), 1)).toBe(false)
    sim.step(intents({ grip: true }, { grip: true }))
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(A(s).action.kind).toBe('grip') // releaser Recovery
    expect(B(s).action).toEqual({ kind: 'idle' }) // TURNING edge had no effect
  })

  it('T126: Morozashi persists while orientation changes; no stored orientation / side / rear state', () => {
    const sim = counterGrip('rear')
    for (let k = 0; k < 70; k++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    }
    const s = sim.getSnapshot()
    expect(Object.keys(s).sort()).toEqual(['arena', 'engagement', 'participants'])
    expect(Object.keys(B(s)).sort()).toEqual(
      ['action', 'bodyRadius', 'externalVelocity', 'facing', 'id', 'position', 'posture', 'velocity'].sort(),
    )
    expect(grappleOrientationSource).not.toMatch(/\b(side|rear|stun|turningTicks)\s*[:=]/)
    expect(grappleOrientationSource).not.toMatch(/from ['"]phaser['"]/)
  })

  it('T127: turning changes facing only; the bond distance and pair axis stay fixed, no NaN', () => {
    const sim = counterGrip('rear')
    const s0 = sim.getSnapshot()
    const axis0 = { x: B(s0).position.x - A(s0).position.x, y: B(s0).position.y - A(s0).position.y }
    for (let k = 0; k < 70; k++) {
      sim.step(intents({ move: [1, 0] }, { move: [0, 1] }))
      const s = sim.getSnapshot()
      expect(dist(s)).toBeCloseTo(COMBINED, 12)
      expect(B(s).position.x - A(s).position.x).toBeCloseTo(axis0.x, 12)
      expect(B(s).position.y - A(s).position.y).toBeCloseTo(axis0.y, 12)
      for (const p of s.participants) expect(Number.isFinite(p.facing + p.position.x + p.position.y)).toBe(true)
    }
  })

  it('T128: FREE instant facing and the Kuzushi freeze are unchanged; release returns to instant facing', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 1, 0))
    sim.step(intents({}, { move: [0, -1] }))
    const s = sim.getSnapshot()
    expect(A(s).facing).toBe(Math.atan2(B(s).position.y - A(s).position.y, B(s).position.x - A(s).position.x))

    // Kuzushi B keeps its frozen facing before the grip
    const k = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) k.step(intents({ counter: t === 0 }, { push: t === 0 }))
    const frozen = B(k.getSnapshot()).facing
    for (let t = 0; t < 5; t++) k.step(intents({ move: [0, 1] }))
    expect(B(k.getSnapshot()).facing).toBe(frozen)

    // the READY holder releases while the victim is still TURNING: FREE snaps it instantly
    const rel = counterGrip('rear')
    rel.step(intents({ grip: true }))
    const r = rel.getSnapshot()
    expect(r.engagement).toEqual({ kind: 'free' })
    expect(B(r).facing).toBe(Math.atan2(A(r).position.y - B(r).position.y, A(r).position.x - B(r).position.x))
  })

  it('T129: front / side / rear sequences replay identically with finite facing', () => {
    const run = (kind: 'front' | 'side' | 'rear') => {
      const sim = kind === 'front' ? frontGrip() : counterGrip(kind)
      for (let k = 0; k < 90; k++) {
        sim.step(intents({ grip: k === 70 }, { grip: k % 7 === 0, move: [0, 1] }))
        for (const p of sim.getSnapshot().participants) expect(Number.isFinite(p.facing)).toBe(true)
      }
      return sim.getSnapshot()
    }
    for (const kind of ['front', 'side', 'rear'] as const) expect(run(kind)).toEqual(run(kind))
  })
})
