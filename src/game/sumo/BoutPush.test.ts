import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  EXTERNAL_DECELERATION,
  MAX_EXTERNAL_SPEED,
  PUSH_ACTIVE_TICKS,
  PUSH_EXTERNAL_ACCELERATION,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  TICK_SECONDS,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from './BoutTypes.ts'

const COMBINED = 2 * BODY_RADIUS
const PUSH_TOTAL_TICKS = PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS + PUSH_RECOVERY_TICKS

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
}

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  const one = (i: Input): ParticipantIntent => ({
    move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
    pushPressed: i.push ?? false,
    counterPressed: false,
    gripPressed: false,
    driveHeld: false,
  })
  return new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
}

const IDLE = intents()

function stepN(sim: BoutSimulation, n: number, i = IDLE): void {
  for (let k = 0; k < n; k++) sim.step(i)
}

const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const dist = (s: BoutSnapshot) =>
  Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)

function phaseOf(s: BoutSnapshot, which: 0 | 1): string {
  const action = s.participants[which].action
  return action.kind === 'push' ? action.phase : 'idle'
}

function expectFinite(s: BoutSnapshot): void {
  for (const p of s.participants) {
    for (const v of [
      p.position.x,
      p.position.y,
      p.velocity.x,
      p.velocity.y,
      p.externalVelocity.x,
      p.externalVelocity.y,
      p.facing,
    ]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  }
}

describe('discrete Push action (ACTION-03B)', () => {
  it('T37: one pushPressed edge starts a Push with the direction locked from facing', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 0.5, 1.5))
    const facing = A(sim.getSnapshot()).facing
    expect(A(sim.getSnapshot()).action).toEqual({ kind: 'idle' })
    sim.step(intents({ push: true }))
    const action = A(sim.getSnapshot()).action
    expect(action.kind).toBe('push')
    if (action.kind !== 'push') return
    expect(action.phase).toBe('startup')
    expect(action.ticksRemaining).toBe(PUSH_STARTUP_TICKS - 1)
    expect(action.direction.x).toBeCloseTo(Math.cos(facing), 12)
    expect(action.direction.y).toBeCloseTo(Math.sin(facing), 12)
    expect(B(sim.getSnapshot()).action).toEqual({ kind: 'idle' })
  })

  it('T38: startup -> active -> recovery -> idle with exact tick counts', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 50, 0))
    const applied: string[] = []
    // The phase that applies to tick k is the phase shown after tick k-1 (press tick starts startup).
    sim.step(intents({ push: true }))
    applied.push('startup')
    for (let k = 1; k < PUSH_TOTAL_TICKS + 5; k++) {
      applied.push(phaseOf(sim.getSnapshot(), 0))
      const action = A(sim.getSnapshot()).action
      if (action.kind === 'push') {
        expect(action.ticksRemaining).toBeGreaterThanOrEqual(1)
        expect(Number.isInteger(action.ticksRemaining)).toBe(true)
      }
      sim.step(IDLE)
    }
    const count = (ph: string) => applied.filter((x) => x === ph).length
    expect(count('startup')).toBe(PUSH_STARTUP_TICKS)
    expect(count('active')).toBe(PUSH_ACTIVE_TICKS)
    expect(count('recovery')).toBe(PUSH_RECOVERY_TICKS)
    expect(applied.slice(0, PUSH_TOTAL_TICKS)).toEqual([
      ...Array(PUSH_STARTUP_TICKS).fill('startup'),
      ...Array(PUSH_ACTIVE_TICKS).fill('active'),
      ...Array(PUSH_RECOVERY_TICKS).fill('recovery'),
    ])
    expect(applied[PUSH_TOTAL_TICKS]).toBe('idle')
  })

  it('T38: presses during an action are ignored and not queued; a new press after idle works', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 50, 0))
    sim.step(intents({ push: true }))
    for (let k = 1; k < PUSH_TOTAL_TICKS; k++) sim.step(intents({ push: true })) // mashing/holding
    expect(phaseOf(sim.getSnapshot(), 0)).toBe('idle')
    stepN(sim, 30)
    expect(phaseOf(sim.getSnapshot(), 0)).toBe('idle') // nothing was queued
    sim.step(intents({ push: true }))
    expect(phaseOf(sim.getSnapshot(), 0)).toBe('startup')
  })

  it('T39: the Push direction does not retarget when the opponent moves', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 1, 0))
    sim.step(intents({ push: true }))
    const locked = A(sim.getSnapshot()).action
    for (let k = 1; k < PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS; k++) {
      sim.step(intents({}, { move: [0, 1] })) // B walks away sideways; A keeps auto-facing B
      const action = A(sim.getSnapshot()).action
      if (action.kind === 'push' && locked.kind === 'push') {
        expect(action.direction).toEqual(locked.direction)
      }
    }
    expect(A(sim.getSnapshot()).facing).toBeGreaterThan(0.1) // facing did follow B
  })

  it('T40: WASD does not steer during the Push and resumes afterwards', () => {
    const steered = new BoutSimulation(setupAt(-1, 0, 50, 0))
    const neutral = new BoutSimulation(setupAt(-1, 0, 50, 0))
    steered.step(intents({ push: true, move: [0, 1] }))
    neutral.step(intents({ push: true }))
    for (let k = 1; k < PUSH_TOTAL_TICKS; k++) {
      steered.step(intents({ move: [0, 1] }))
      neutral.step(IDLE)
      expect(A(steered.getSnapshot()).position).toEqual(A(neutral.getSnapshot()).position)
    }
    expect(phaseOf(steered.getSnapshot(), 0)).toBe('idle')
    steered.step(intents({ move: [0, 1] }))
    expect(A(steered.getSnapshot()).velocity.y).toBeGreaterThan(0)
  })

  it('T40: active phase drives along the locked direction', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 50, 0))
    sim.step(intents({ push: true }))
    stepN(sim, PUSH_STARTUP_TICKS - 1)
    expect(A(sim.getSnapshot()).velocity).toEqual({ x: 0, y: 0 })
    stepN(sim, PUSH_ACTIVE_TICKS)
    const v = A(sim.getSnapshot()).velocity
    expect(v.x).toBeGreaterThan(0)
    expect(v.y).toBeCloseTo(0, 12)
  })

  it('T41: a non-contact Push is a short committed step with no external momentum', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 50, 0))
    sim.step(intents({ push: true }))
    for (let k = 1; k < PUSH_TOTAL_TICKS + 30; k++) {
      sim.step(IDLE)
      expect(A(sim.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
    }
    const travelled = A(sim.getSnapshot()).position.x + 1
    expect(travelled).toBeGreaterThan(0.05)
    expect(travelled).toBeLessThan(0.3) // a step, not a dash
    expect(A(sim.getSnapshot()).velocity).toEqual({ x: 0, y: 0 })
  })

  it('T41: a Push started while running brakes during startup instead of dashing', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 50, 0))
    stepN(sim, 60, intents({ move: [0, 1] })) // full speed downward
    sim.step(intents({ push: true, move: [0, 1] }))
    stepN(sim, PUSH_STARTUP_TICKS - 1, intents({ move: [0, 1] }))
    expect(speed(A(sim.getSnapshot()).velocity)).toBeLessThan(1)
  })

  it('T42: an active Push in contact moves the pair toward the defender side', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({ push: true }))
    let maxExternal = 0
    for (let k = 1; k < PUSH_TOTAL_TICKS + 60; k++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expect(dist(s)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
      expect(B(s).externalVelocity).toEqual(A(s).externalVelocity)
      expect(B(s).externalVelocity.y).toBeCloseTo(0, 12)
      maxExternal = Math.max(maxExternal, B(s).externalVelocity.x)
    }
    const s = sim.getSnapshot()
    expect(maxExternal).toBeGreaterThan(0)
    expect(B(s).position.x - COMBINED).toBeGreaterThan(0.1) // defender was driven back
    expect(B(s).position.y).toBeCloseTo(0, 12)
    expect(speed(B(s).velocity)).toBe(0) // everything settles
  })

  it('T42: no external momentum is created while not active', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({ push: true }))
    for (let k = 1; k < PUSH_STARTUP_TICKS; k++) {
      sim.step(IDLE)
      expect(B(sim.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
    }
  })

  it('T42: B pushing A mirrors the direction', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({}, { push: true }))
    stepN(sim, PUSH_TOTAL_TICKS + 60)
    const s = sim.getSnapshot()
    expect(A(s).position.x).toBeLessThan(-0.1)
    expect(B(s).position.x).toBeLessThan(COMBINED)
  })

  it('T43: equal simultaneous Pushes cancel with no external drive and no jitter', () => {
    const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    sim.step(intents({ push: true }, { push: true }))
    for (let k = 1; k < PUSH_TOTAL_TICKS + 30; k++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expectFinite(s)
      expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(B(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(s).position.x + B(s).position.x).toBeCloseTo(0, 12)
      expect(dist(s)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
    }
    expect(dist(sim.getSnapshot())).toBeCloseTo(COMBINED, 9)
  })

  it('T44: external momentum decays monotonically to exact zero without reversal', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({ push: true }))
    stepN(sim, PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS)
    let prev = speed(B(sim.getSnapshot()).externalVelocity)
    expect(prev).toBeGreaterThan(0)
    expect(prev).toBeLessThanOrEqual(MAX_EXTERNAL_SPEED)
    let ticks = 0
    while (speed(B(sim.getSnapshot()).externalVelocity) > 0) {
      sim.step(IDLE)
      const e = B(sim.getSnapshot()).externalVelocity
      expect(speed(e)).toBeLessThan(prev)
      expect(e.x).toBeGreaterThanOrEqual(0)
      prev = speed(e)
      expect(++ticks).toBeLessThan(1000)
    }
    expect(B(sim.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
  })

  it('T44: the per-tick active gain and decay follow the provisional constants', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({ push: true }))
    stepN(sim, PUSH_STARTUP_TICKS) // the first active tick has been resolved
    expect(B(sim.getSnapshot()).externalVelocity.x).toBeCloseTo(
      PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS,
      12,
    )
    sim.step(IDLE) // second active tick: decay then gain
    expect(B(sim.getSnapshot()).externalVelocity.x).toBeCloseTo(
      2 * PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS - EXTERNAL_DECELERATION * TICK_SECONDS,
      12,
    )
  })

  it('T45: external momentum is not erased by grounded footwork damping', () => {
    const sim = new BoutSimulation(setupAt(0, 0, COMBINED, 0))
    sim.step(intents({ push: true }))
    stepN(sim, PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS - 1)
    const e0 = B(sim.getSnapshot()).externalVelocity.x
    // B now steers perpendicular (lateral damping would kill this x motion fast if it were footwork)
    for (let k = 1; k <= 5; k++) {
      sim.step(intents({}, { move: [0, -1] }))
      const s = sim.getSnapshot()
      expect(B(s).externalVelocity.x).toBeCloseTo(e0 - k * EXTERNAL_DECELERATION * TICK_SECONDS, 12)
      // total = own footwork + external: B's own footwork is purely its upward step
      expect(B(s).velocity.x - B(s).externalVelocity.x).toBeCloseTo(0, 12)
      expect(B(s).velocity.y).toBeLessThan(0)
    }
  })

  it('T46: contact without Push never creates external momentum or creep', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 0, 0))
    for (let k = 0; k < 600; k++) {
      sim.step(intents({ move: [1, 0] }))
      const s = sim.getSnapshot()
      expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(B(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(B(s).position).toEqual({ x: 0, y: 0 })
    }
  })

  it('T47: with no Push, snapshot velocity equals the footwork-only movement', () => {
    // ACTION-06A: the distant opponent must start inside the ring (x = 1000 would be an instant ring-out).
    const sim = new BoutSimulation(setupAt(-1.5, 0, 90, 0))
    for (let k = 0; k < 40; k++) sim.step(intents({ move: [0, -1] }))
    const s = sim.getSnapshot()
    expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
    expect(A(s).action).toEqual({ kind: 'idle' })
  })

  it('T48: mixed Push / movement sequences are deterministic and finite', () => {
    const run = () => {
      const sim = new BoutSimulation(setupAt(-0.6, 0.1, 0.4, -0.05))
      const script: [number, Input, Input][] = [
        [1, { push: true }, {}],
        [20, { move: [1, 0] }, { move: [-1, 0.3] }],
        [1, {}, { push: true }],
        [30, { move: [0.5, 0.5] }, {}],
        [1, { push: true }, { push: true }],
        [40, { move: [-1, 0] }, { move: [0, 1] }],
        [1, { push: true }, {}],
        [60, {}, { move: [-1, 0] }],
      ]
      for (const [n, ia, ib] of script) {
        for (let k = 0; k < n; k++) {
          sim.step(intents(ia, ib))
          expectFinite(sim.getSnapshot())
          expect(dist(sim.getSnapshot())).toBeGreaterThanOrEqual(COMBINED - 1e-9)
        }
      }
      return sim.getSnapshot()
    }
    expect(run()).toEqual(run())
  })

  it('snapshot action state is an isolated copy', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 1, 0))
    sim.step(intents({ push: true }))
    const s = sim.getSnapshot()
    const action = A(s).action as unknown as { ticksRemaining: number; direction: { x: number } }
    action.ticksRemaining = 99
    action.direction.x = 99
    const again = A(sim.getSnapshot()).action
    expect(again.kind === 'push' && again.ticksRemaining).toBe(PUSH_STARTUP_TICKS - 1)
    expect(again.kind === 'push' && again.direction.x).toBeCloseTo(1, 12)
  })
})
