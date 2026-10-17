import { describe, expect, it } from 'vitest'
import {
  ACCELERATION,
  BoutSimulation,
  DECELERATION,
  MAX_SPEED,
  TICK_SECONDS,
} from './BoutSimulation.ts'
import type { BoutSetup, ParticipantId, ParticipantIntent } from './BoutTypes.ts'
import simulationSource from './BoutSimulation.ts?raw'
import typesSource from './BoutTypes.ts?raw'
import accumulatorSource from './FixedStepAccumulator.ts?raw'
import movementVectorSource from '../input/movementVector.ts?raw'

interface MutableSetupLike {
  arena: { radius: number }
  participants: { id: string; position: { x: number; y: number } }[]
}

function makeSetup(): BoutSetup {
  return {
    arena: { radius: 100 },
    participants: [
      { id: 'a', position: { x: -10, y: 0 } },
      { id: 'b', position: { x: 10, y: 0 } },
    ],
  }
}

function intent(x: number, y: number): Map<ParticipantId, ParticipantIntent> {
  return new Map([['a', { move: { x, y } }]])
}

const NO_INTENT = new Map<ParticipantId, ParticipantIntent>()

function stepN(sim: BoutSimulation, n: number, intents = NO_INTENT): void {
  for (let i = 0; i < n; i++) sim.step(intents)
}

function a(sim: BoutSimulation) {
  return sim.getSnapshot().participants[0]
}

describe('BoutSimulation setup / isolation', () => {
  it('creates a 2-participant snapshot from a valid setup', () => {
    const snap = new BoutSimulation(makeSetup()).getSnapshot()
    expect(snap.participants.map((p) => p.id)).toEqual(['a', 'b'])
    expect(snap.arena.radius).toBe(100)
    expect(snap.participants[0].position).toEqual({ x: -10, y: 0 })
    expect(snap.participants[1].position).toEqual({ x: 10, y: 0 })
  })

  it('rejects invalid setups', () => {
    const base = makeSetup()
    expect(
      () => new BoutSimulation({ ...base, participants: [base.participants[0], base.participants[0]] }),
    ).toThrow(/duplicate/)
    expect(() => new BoutSimulation({ ...base, arena: { radius: 0 } })).toThrow()
    expect(() => new BoutSimulation({ ...base, arena: { radius: NaN } })).toThrow()
    expect(() => new BoutSimulation({ ...base, participants: [base.participants[0]] })).toThrow(
      /2 participants/,
    )
    expect(
      () =>
        new BoutSimulation({
          ...base,
          participants: [
            { id: 'a', position: { x: Infinity, y: 0 } },
            { id: 'b', position: { x: 0, y: 0 } },
          ],
        }),
    ).toThrow(/finite/)
    expect(
      () =>
        new BoutSimulation({
          ...base,
          participants: [
            { id: '', position: { x: 0, y: 0 } },
            { id: 'b', position: { x: 1, y: 0 } },
          ],
        }),
    ).toThrow(/empty/)
  })

  it('T9: does not alias the caller setup', () => {
    const setup = makeSetup()
    const sim = new BoutSimulation(setup)
    const mutable = setup as unknown as MutableSetupLike
    mutable.arena.radius = 999
    mutable.participants[0].position.x = 999
    mutable.participants[0].id = 'changed'
    const snap = sim.getSnapshot()
    expect(snap.arena.radius).toBe(100)
    expect(snap.participants[0].position.x).toBe(-10)
    expect(snap.participants[0].id).toBe('a')
  })

  it('T9: snapshot mutation does not affect canonical state', () => {
    const sim = new BoutSimulation(makeSetup())
    sim.step(intent(1, 0))
    const before = a(sim)
    const snap = sim.getSnapshot() as unknown as {
      arena: { radius: number }
      participants: {
        id: string
        position: { x: number; y: number }
        velocity: { x: number; y: number }
        facing: number
      }[]
    }
    snap.arena.radius = 999
    snap.participants[0].position.x = 999
    snap.participants[0].velocity.x = 999
    snap.participants[0].facing = 999
    snap.participants[0].id = 'changed'
    snap.participants.pop()
    const next = sim.getSnapshot()
    expect(next.arena.radius).toBe(100)
    expect(next.participants).toHaveLength(2)
    expect(next.participants[0]).toEqual(before)
  })
})

describe('BoutSimulation movement', () => {
  it('T1: same setup + same intent sequence gives the same state', () => {
    const run = () => {
      const sim = new BoutSimulation(makeSetup())
      stepN(sim, 30, intent(1, 0))
      stepN(sim, 20, intent(0.3, -0.8))
      stepN(sim, 40)
      return sim.getSnapshot()
    }
    expect(run()).toEqual(run())
  })

  it('T2: zero intent keeps a stationary participant still and decelerates existing velocity', () => {
    const still = new BoutSimulation(makeSetup())
    stepN(still, 60)
    expect(a(still).position).toEqual({ x: -10, y: 0 })
    expect(a(still).velocity).toEqual({ x: 0, y: 0 })

    const moving = new BoutSimulation(makeSetup())
    stepN(moving, 60, intent(1, 0))
    const v0 = a(moving).velocity.x
    moving.step(NO_INTENT)
    expect(a(moving).velocity.x).toBeCloseTo(v0 - DECELERATION * TICK_SECONDS, 10)
  })

  it('T3: cardinal intents move along the correct world axis', () => {
    const cases: [number, number, 'x' | 'y', 1 | -1][] = [
      [0, -1, 'y', -1],
      [0, 1, 'y', 1],
      [-1, 0, 'x', -1],
      [1, 0, 'x', 1],
    ]
    for (const [ix, iy, axis, sign] of cases) {
      const sim = new BoutSimulation(makeSetup())
      const start = a(sim).position
      stepN(sim, 30, intent(ix, iy))
      const end = a(sim).position
      expect((end[axis] - start[axis]) * sign).toBeGreaterThan(0)
      const other = axis === 'x' ? 'y' : 'x'
      expect(end[other]).toBeCloseTo(start[other], 10)
    }
  })

  it('T4: diagonal and oversized intents are clamped (no speed advantage)', () => {
    const cardinal = new BoutSimulation(makeSetup())
    stepN(cardinal, 120, intent(1, 0))
    const diagonal = new BoutSimulation(makeSetup())
    stepN(diagonal, 120, intent(1, 1))
    const huge = new BoutSimulation(makeSetup())
    stepN(huge, 120, intent(100, 0))
    const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)
    expect(speed(a(cardinal).velocity)).toBeCloseTo(MAX_SPEED, 9)
    expect(speed(a(diagonal).velocity)).toBeCloseTo(MAX_SPEED, 9)
    expect(speed(a(huge).velocity)).toBeCloseTo(MAX_SPEED, 9)
  })

  it('treats non-finite intent as no input', () => {
    const sim = new BoutSimulation(makeSetup())
    stepN(sim, 5, intent(NaN, Infinity))
    expect(a(sim).velocity).toEqual({ x: 0, y: 0 })
    expect(a(sim).position).toEqual({ x: -10, y: 0 })
  })

  it('T5: velocity accelerates gradually toward the target speed', () => {
    const sim = new BoutSimulation(makeSetup())
    sim.step(intent(1, 0))
    expect(a(sim).velocity.x).toBeCloseTo(ACCELERATION * TICK_SECONDS, 10)
    expect(a(sim).velocity.x).toBeLessThan(MAX_SPEED)

    const ticksToMax = Math.ceil(MAX_SPEED / ACCELERATION / TICK_SECONDS)
    stepN(sim, ticksToMax, intent(1, 0))
    expect(a(sim).velocity.x).toBe(MAX_SPEED)
    stepN(sim, 30, intent(1, 0))
    expect(a(sim).velocity.x).toBe(MAX_SPEED)
  })

  it('T6: velocity decays to exactly zero after release without overshoot or NaN', () => {
    const sim = new BoutSimulation(makeSetup())
    stepN(sim, 60, intent(1, -1))
    let prevSpeed = Math.hypot(a(sim).velocity.x, a(sim).velocity.y)
    const ticksToStop = Math.ceil(MAX_SPEED / DECELERATION / TICK_SECONDS) + 1
    for (let i = 0; i < ticksToStop; i++) {
      sim.step(NO_INTENT)
      const v = a(sim).velocity
      const speed = Math.hypot(v.x, v.y)
      expect(Number.isFinite(speed)).toBe(true)
      expect(speed).toBeLessThanOrEqual(prevSpeed)
      // direction never reverses
      expect(v.x).toBeGreaterThanOrEqual(0)
      expect(v.y).toBeLessThanOrEqual(0)
      prevSpeed = speed
    }
    expect(a(sim).velocity).toEqual({ x: 0, y: 0 })
    const stopped = a(sim).position
    stepN(sim, 10)
    expect(a(sim).position).toEqual(stopped)
  })

  it('T8: participants face each other and update as positions change', () => {
    const sim = new BoutSimulation(makeSetup())
    let [pa, pb] = sim.getSnapshot().participants
    expect(pa.facing).toBeCloseTo(0, 10) // a faces +x toward b
    expect(pb.facing).toBeCloseTo(Math.PI, 10) // b faces -x toward a

    stepN(sim, 60, intent(0, 1)) // a moves down (+y)
    ;[pa, pb] = sim.getSnapshot().participants
    expect(pa.position.y).toBeGreaterThan(0)
    expect(pa.facing).toBeCloseTo(
      Math.atan2(pb.position.y - pa.position.y, pb.position.x - pa.position.x),
      10,
    )
    expect(pa.facing).toBeLessThan(0) // b is now above-right of a
    expect(pb.facing).toBeCloseTo(
      Math.atan2(pa.position.y - pb.position.y, pa.position.x - pb.position.x),
      10,
    )
  })

  it('T8: coincident positions keep the previous facing without NaN', () => {
    const sim = new BoutSimulation({
      arena: { radius: 100 },
      participants: [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 0, y: 0 } },
      ],
    })
    for (const p of sim.getSnapshot().participants) {
      expect(Number.isFinite(p.facing)).toBe(true)
    }
    stepN(sim, 10)
    for (const p of sim.getSnapshot().participants) {
      expect(Number.isFinite(p.facing)).toBe(true)
      expect(Number.isFinite(p.position.x)).toBe(true)
    }
  })
})

describe('Phaser independence', () => {
  it('T10: simulation / fixed-step / input-vector sources do not depend on Phaser', () => {
    for (const src of [simulationSource, typesSource, accumulatorSource, movementVectorSource]) {
      expect(src).not.toMatch(/from\s+['"]phaser['"]/)
      expect(src).not.toMatch(/import\s+['"]phaser['"]/)
      expect(src).not.toMatch(/require\(\s*['"]phaser['"]/)
    }
  })
})
