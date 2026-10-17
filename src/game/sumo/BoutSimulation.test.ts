import { describe, expect, it } from 'vitest'
import { BoutSimulation } from './BoutSimulation.ts'
import type { BoutSetup } from './BoutTypes.ts'
import simulationSource from './BoutSimulation.ts?raw'
import typesSource from './BoutTypes.ts?raw'

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

describe('BoutSimulation', () => {
  it('T1: creates a 2-participant snapshot from a valid setup', () => {
    const snap = new BoutSimulation(makeSetup()).getSnapshot()
    expect(snap.participants.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('T2: reflects setup positions and arena geometry', () => {
    const snap = new BoutSimulation(makeSetup()).getSnapshot()
    expect(snap.arena.radius).toBe(100)
    expect(snap.participants[0].position).toEqual({ x: -10, y: 0 })
    expect(snap.participants[1].position).toEqual({ x: 10, y: 0 })
  })

  it('T3: rejects invalid setups', () => {
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

  it('T4: does not alias the caller setup', () => {
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

  it('T5: snapshot mutation does not affect canonical state', () => {
    const sim = new BoutSimulation(makeSetup())
    const snap = sim.getSnapshot() as unknown as MutableSetupLike
    snap.arena.radius = 999
    snap.participants[0].position.x = 999
    snap.participants[0].id = 'changed'
    snap.participants.pop()
    const next = sim.getSnapshot()
    expect(next.arena.radius).toBe(100)
    expect(next.participants).toHaveLength(2)
    expect(next.participants[0].position.x).toBe(-10)
    expect(next.participants[0].id).toBe('a')
  })

  it('T6: simulation sources do not depend on Phaser', () => {
    for (const src of [simulationSource, typesSource]) {
      expect(src).not.toMatch(/from\s+['"]phaser['"]/)
      expect(src).not.toMatch(/import\s+['"]phaser['"]/)
      expect(src).not.toMatch(/require\(\s*['"]phaser['"]/)
    }
  })
})
