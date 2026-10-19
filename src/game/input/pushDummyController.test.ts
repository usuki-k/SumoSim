import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, PUSH_ACTIVE_TICKS, PUSH_RECOVERY_TICKS, PUSH_STARTUP_TICKS } from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import { DUMMY_PUSH_COOLDOWN_TICKS, PushDummyController } from './pushDummyController.ts'

const PUSH_TOTAL_TICKS = PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS + PUSH_RECOVERY_TICKS
const COMBINED = 2 * BODY_RADIUS

function setup(ax: number, bx: number): BoutSetup {
  return {
    arena: { radius: 100 },
    participants: [
      { id: 'a', position: { x: ax, y: 0 } },
      { id: 'b', position: { x: bx, y: 0 } },
    ],
  }
}

const IDLE_INTENT: ParticipantIntent = { move: { x: 0, y: 0 }, pushPressed: false }

function newDummy(mode: 'stationary' | 'push' = 'push'): PushDummyController {
  const dummy = new PushDummyController('b', 'a')
  dummy.setMode(mode)
  return dummy
}

// One Simulation tick driven the way the Scene does: dummy intent from the pre-step Snapshot.
function tick(sim: BoutSimulation, dummy: PushDummyController, playerPush = false): ParticipantIntent {
  const dummyIntent = dummy.nextIntent(sim.getSnapshot())
  sim.step(
    new Map<ParticipantId, ParticipantIntent>([
      ['a', { move: { x: 0, y: 0 }, pushPressed: playerPush }],
      ['b', dummyIntent],
    ]),
  )
  return dummyIntent
}

const a = (s: BoutSnapshot) => s.participants[0]
const b = (s: BoutSnapshot) => s.participants[1]
const idle = (s: BoutSnapshot, i: 0 | 1) => s.participants[i].action.kind === 'idle'

describe('PushDummyController (ACTION-03B2)', () => {
  it('T50: STATIONARY mode emits no move and no Push edge, deterministically', () => {
    const sim = new BoutSimulation(setup(-0.3, 0.3))
    const dummy = newDummy('stationary')
    for (let i = 0; i < 100; i++) expect(dummy.nextIntent(sim.getSnapshot())).toEqual(IDLE_INTENT)
  })

  it('T51: PUSH mode approaches the player with a normalized move and no edge while separated', () => {
    const sim = new BoutSimulation(setup(-2, 2))
    const intent = newDummy().nextIntent(sim.getSnapshot())
    expect(intent.pushPressed).toBe(false)
    expect(intent.move.x).toBeCloseTo(-1, 12)
    expect(intent.move.y).toBeCloseTo(0, 12)
    // Diagonal separation still gives a unit vector.
    const diag = new BoutSimulation({
      arena: { radius: 100 },
      participants: [
        { id: 'a', position: { x: 0, y: 0 } },
        { id: 'b', position: { x: 3, y: 4 } },
      ],
    })
    const m = newDummy().nextIntent(diag.getSnapshot()).move
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(1, 12)
    expect(m.x).toBeCloseTo(-0.6, 12)
    expect(m.y).toBeCloseTo(-0.8, 12)
  })

  it('T51: approaching dummy reaches Contact and stops moving', () => {
    const sim = new BoutSimulation(setup(-2, 2))
    const dummy = newDummy()
    let firstPush = -1
    for (let t = 0; t < 400 && firstPush < 0; t++) {
      if (tick(sim, dummy).pushPressed) firstPush = t
    }
    expect(firstPush).toBeGreaterThan(0)
    const distance = b(sim.getSnapshot()).position.x - a(sim.getSnapshot()).position.x
    expect(distance).toBeLessThan(COMBINED + 0.05)
  })

  it('T52: in Contact, idle and ready: zero move and exactly one edge, not repeated', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    expect(tick(sim, dummy)).toEqual({ move: { x: 0, y: 0 }, pushPressed: true })
    expect(b(sim.getSnapshot()).action.kind).toBe('push')
    expect(tick(sim, dummy).pushPressed).toBe(false)
  })

  it('T53: respects Startup / Active / Recovery: no edge and zero move for the whole action', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    tick(sim, dummy) // edge
    for (let t = 1; t < PUSH_TOTAL_TICKS; t++) {
      expect(idle(sim.getSnapshot(), 1)).toBe(false)
      expect(tick(sim, dummy)).toEqual(IDLE_INTENT)
    }
    expect(idle(sim.getSnapshot(), 1)).toBe(true)
  })

  it('T54: after the action returns idle, no edge until the exact cooldown expires, then one edge', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    const edges: number[] = []
    for (let t = 0; t < 2 * PUSH_TOTAL_TICKS + DUMMY_PUSH_COOLDOWN_TICKS + 5; t++) {
      if (tick(sim, dummy).pushPressed) edges.push(t)
    }
    expect(edges[0]).toBe(0)
    // First idle tick is PUSH_TOTAL_TICKS; cooldown ticks pass, then the edge.
    expect(edges[1]).toBe(PUSH_TOTAL_TICKS + DUMMY_PUSH_COOLDOWN_TICKS)
  })

  it('T55: mode switch and reset clear cooldown state deterministically', () => {
    const run = (): number[] => {
      const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
      const dummy = newDummy()
      const edges: number[] = []
      for (let t = 0; t < 80; t++) if (tick(sim, dummy).pushPressed) edges.push(t)
      return edges
    }
    expect(run()).toEqual(run())

    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    tick(sim, dummy)
    tick(sim, dummy) // acting: cooldown primed
    dummy.setMode('stationary')
    expect(dummy.nextIntent(sim.getSnapshot())).toEqual(IDLE_INTENT)
    dummy.setMode('push')
    const fresh = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    expect(dummy.nextIntent(fresh.getSnapshot()).pushPressed).toBe(true) // ready immediately
    tick(sim, dummy)
    dummy.reset()
    expect(dummy.nextIntent(fresh.getSnapshot()).pushPressed).toBe(true)
  })

  it('T56: edges depend on Simulation tick count, not frame grouping', () => {
    const edgesFor = (framePlan: number[]): number[] => {
      const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
      const dummy = newDummy()
      const edges: number[] = []
      let t = 0
      for (const ticksInFrame of framePlan) {
        // The Scene calls the controller once per tick, never once per frame.
        for (let i = 0; i < ticksInFrame; i++, t++) if (tick(sim, dummy).pushPressed) edges.push(t)
      }
      return edges
    }
    const total = 150
    const oneByOne = edgesFor(new Array<number>(total).fill(1))
    const grouped = edgesFor([...new Array<number>(total / 5).fill(5)])
    const lumpy = edgesFor([0, 8, 1, 0, 3, ...new Array<number>(total - 12).fill(1)])
    expect(grouped).toEqual(oneByOne)
    expect(lumpy).toEqual(oneByOne)
    // Never two edges within one action.
    for (let i = 1; i < oneByOne.length; i++) {
      expect(oneByOne[i] - oneByOne[i - 1]).toBeGreaterThanOrEqual(PUSH_TOTAL_TICKS)
    }
  })

  it('T57: equal overlapping Active windows from player and dummy give zero net Push', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    // Dummy edge on tick 0 and the player edge on the same tick: Active windows coincide exactly.
    tick(sim, dummy, true)
    for (let t = 1; t < PUSH_TOTAL_TICKS + 5; t++) {
      tick(sim, dummy)
      const s = sim.getSnapshot()
      for (const p of s.participants) {
        for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.externalVelocity.x, p.externalVelocity.y]) {
          expect(Number.isFinite(v)).toBe(true)
        }
      }
      expect(a(s).externalVelocity.x).toBe(0)
      expect(b(s).externalVelocity.x).toBe(0)
      expect(b(s).position.x - a(s).position.x).toBeGreaterThan(COMBINED - 0.05)
    }
  })

  it('T58: dummy Push moves the player backward through the existing Push Core', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy()
    const startX = a(sim.getSnapshot()).position.x
    for (let t = 0; t < PUSH_TOTAL_TICKS + 20; t++) tick(sim, dummy)
    const s = sim.getSnapshot()
    expect(a(s).position.x).toBeLessThan(startX - 0.05) // player pushed to -x, away from the dummy
    expect(b(s).position.x - a(s).position.x).toBeGreaterThan(COMBINED - 0.05)
    expect(b(s).position.x - a(s).position.x).toBeLessThan(COMBINED + 0.05)
  })

  it('T59: STATIONARY mode leaves the opponent untouched while the player acts', () => {
    const sim = new BoutSimulation(setup(-COMBINED / 2, COMBINED / 2))
    const dummy = newDummy('stationary')
    tick(sim, dummy, true)
    for (let t = 1; t < PUSH_TOTAL_TICKS; t++) tick(sim, dummy)
    expect(b(sim.getSnapshot()).action.kind).toBe('idle')
    expect(b(sim.getSnapshot()).position.x).toBeGreaterThan(COMBINED / 2) // pushed away by the player only
  })
})
