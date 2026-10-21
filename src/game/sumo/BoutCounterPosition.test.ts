import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_OVERSHOOT_SPEED,
  COUNTER_STAGGER_DISTANCE,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  CONTACT_SLOP,
  KUZUSHI_TICKS,
  MAX_EXTERNAL_SPEED,
  PUSH_STARTUP_TICKS,
  counterRelocationTarget,
  counterTier,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, Vec2 } from './BoutTypes.ts'

const COMBINED = 2 * BODY_RADIUS

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
}

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  const one = (i: Input): ParticipantIntent => ({
    move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
    pushPressed: i.push ?? false,
    counterPressed: i.counter ?? false,
    gripPressed: false,
    driveHeld: false,
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
const speed = (v: Vec2) => Math.hypot(v.x, v.y)

function expectFinite(s: BoutSnapshot): void {
  for (const p of s.participants) {
    for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.externalVelocity.x, p.externalVelocity.y, p.facing]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  }
}

// B (attacker) presses Push on tick 0; A presses Counter on `counterTick`, optionally walking laterally
// on ticks 1..4. Returns the snapshots just before and after the resolving tick (B enters Kuzushi).
function counterScenario(opts: { counterTick: number; lateral?: number; setup?: BoutSetup }) {
  const sim = new BoutSimulation(opts.setup ?? setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
  for (let t = 0; t < 60; t++) {
    const before = sim.getSnapshot()
    const walk = opts.lateral !== undefined && t >= 1 && t <= 4
    sim.step(
      intents(
        { counter: t === opts.counterTick, move: walk ? [0, opts.lateral ?? 0] : undefined },
        { push: t === 0 },
      ),
    )
    const after = sim.getSnapshot()
    if (B(before).posture.kind === 'stable' && B(after).posture.kind === 'kuzushi') {
      return { sim, before, after, t }
    }
  }
  throw new Error('Counter did not resolve')
}

function lockedDirection(s: BoutSnapshot): Vec2 {
  const action = B(s).action
  if (action.kind !== 'push') throw new Error('attacker not pushing')
  return action.direction
}

// Tier the attacker's current active Push would give a Counter resolving on the next tick.
function tierOf(s: BoutSnapshot): string | null {
  const action = B(s).action
  return action.kind === 'push' ? counterTier(action.ticksRemaining) : null
}

function pushPhase(s: BoutSnapshot): string | null {
  const action = B(s).action
  return action.kind === 'push' ? action.phase : null
}

function expectAt(p: Vec2, q: Vec2): void {
  expect(p.x).toBeCloseTo(q.x, 12)
  expect(p.y).toBeCloseTo(q.y, 12)
}

const SUCCESS_TICK = PUSH_STARTUP_TICKS + 4

// Runs the Counter transition (ACTION-04A4) to completion and returns the completion Snapshot.
function complete(sim: BoutSimulation): BoutSnapshot {
  for (let k = 0; k < COUNTER_TRANSITION_TICKS; k++) sim.step(IDLE)
  const s = sim.getSnapshot()
  expect(s.counterTransition).toEqual({ kind: 'none' })
  return s
}

// The pusher's end point: its catch position plus the stagger along the locked Push direction.
function pusherEnd(after: BoutSnapshot, d: Vec2): Vec2 {
  const p = B(after).position
  return { x: p.x + d.x * COUNTER_STAGGER_DISTANCE, y: p.y + d.y * COUNTER_STAGGER_DISTANCE }
}

describe('Counter position resolution (ACTION-04A2)', () => {
  it('T78: Best ends the defender at the attacker rear (after its stagger) at exact contact distance', () => {
    const { sim, before, after } = counterScenario({ counterTick: 0 })
    expect(tierOf(before)).toBe('best')
    const d = lockedDirection(before)
    const end = pusherEnd(after, d)
    const done = complete(sim)
    expectAt(B(done).position, end)
    expectAt(A(done).position, { x: end.x - d.x * COMBINED, y: end.y - d.y * COMBINED })
    expect(dist(done)).toBeCloseTo(COMBINED, 12)
    expect(B(done).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    expect(A(done).posture).toEqual({ kind: 'stable' })
    expect(A(done).action).toEqual({ kind: 'idle' })
    expect(A(done).position.x).toBeGreaterThan(B(done).position.x) // behind B, who pushed toward -x
  })

  it('T79: Success picks the side the defender leans to (both signs), at contact distance', () => {
    for (const lateral of [1, -1]) {
      const { sim, before, after } = counterScenario({ counterTick: SUCCESS_TICK, lateral })
      expect(tierOf(before)).toBe('success')
      const d = lockedDirection(before)
      const perp = { x: -d.y, y: d.x }
      const p = B(after).position
      const offset = perp.x * (A(before).position.x - p.x) + perp.y * (A(before).position.y - p.y)
      const sign = offset > 0 ? 1 : -1
      // d is about -x, so perp is about -y: walking +y gives a negative offset -> side- (+y side)
      expect(sign).toBe(lateral > 0 ? -1 : 1)
      const end = pusherEnd(after, d)
      const done = complete(sim)
      expectAt(A(done).position, { x: end.x + sign * perp.x * COMBINED, y: end.y + sign * perp.y * COMBINED })
      expect(Math.sign(A(done).position.y)).toBe(lateral)
      expect(dist(done)).toBeCloseTo(COMBINED, 12)
    }
  })

  it('T80: side tie-break: ring-center-nearer side, then fixed side+', () => {
    const d = { x: -1, y: 0 } // perp = (0, -1): side+ is -y, side- is +y
    // tie (defender on the axis), attacker below center: side- (+y... away) vs side+ (toward center)
    const p = { x: 0, y: 1 }
    const defender = { x: -COMBINED, y: 1 }
    expectAt(counterRelocationTarget('success', p, d, COMBINED, defender, 50)!, { x: 0, y: 1 - COMBINED })
    const pAbove = { x: 0, y: -1 }
    expectAt(counterRelocationTarget('success', pAbove, d, COMBINED, { x: -COMBINED, y: -1 }, 50)!, {
      x: 0,
      y: -1 + COMBINED,
    })
    // within epsilon still counts as a tie
    expectAt(counterRelocationTarget('success', p, d, COMBINED, { x: -COMBINED, y: 1 + 1e-9 }, 50)!, {
      x: 0,
      y: 1 - COMBINED,
    })
    // exact remaining tie (symmetric about the center) -> side+
    expectAt(counterRelocationTarget('success', { x: 0, y: 0 }, d, COMBINED, { x: -COMBINED, y: 0 }, 50)!, {
      x: 0,
      y: -COMBINED,
    })
    // a clear lean overrides the center preference
    expectAt(counterRelocationTarget('success', p, d, COMBINED, { x: -COMBINED, y: 1.1 }, 50)!, {
      x: 0,
      y: 1 + COMBINED,
    })
  })

  it('T81: invalid preferred side falls back to the other; none valid -> no relocation', () => {
    const d = { x: -1, y: 0 }
    const p = { x: 0, y: 1 }
    const leansPlusY = { x: -COMBINED, y: 1.1 } // prefers side- at y = 1.7
    // max center distance 1.5: side- (|1.7|) invalid, side+ (|0.3|) valid
    expectAt(counterRelocationTarget('success', p, d, COMBINED, leansPlusY, 1.5)!, { x: 0, y: 1 - COMBINED })
    // max 0.2: both invalid
    expect(counterRelocationTarget('success', p, d, COMBINED, leansPlusY, 0.2)).toBeNull()
  })

  it('T81: integration — Success with no valid side leaves the defender in place but still Kuzushi', () => {
    const setup = setupAt(-COMBINED / 2, 0, COMBINED / 2, 0, 1.0) // max center distance 0.65
    const { before, after } = counterScenario({ counterTick: SUCCESS_TICK, setup })
    expect(tierOf(before)).toBe('success')
    expect(B(after).posture.kind).toBe('kuzushi')
    expect(A(after).position.y).toBeCloseTo(0, 12)
    expect(Math.abs(A(after).position.x - A(before).position.x)).toBeLessThan(0.05)
    expect(dist(after)).toBeLessThanOrEqual(COMBINED + CONTACT_SLOP)
    expect(B(after).externalVelocity.x - A(after).externalVelocity.x).toBeCloseTo(-COUNTER_OVERSHOOT_SPEED, 12)
  })

  it('T82: Best fallback order rear -> preferred side -> other side -> none', () => {
    const d = { x: -1, y: 0 }
    const p = { x: 1, y: 0.2 } // rear at x = 1.7
    const leansMinusY = { x: 1 - COMBINED, y: 0.1 } // offset = -(0.1 - 0.2) > 0 -> prefers side+ (y = -0.5)
    expectAt(counterRelocationTarget('best', p, d, COMBINED, leansMinusY, 2)!, { x: 1 + COMBINED, y: 0.2 })
    // rear (|(1.7,0.2)| ~ 1.71) invalid, side+ (|(1,-0.5)| ~ 1.118) valid
    expectAt(counterRelocationTarget('best', p, d, COMBINED, leansMinusY, 1.5)!, { x: 1, y: 0.2 - COMBINED })
    // with a lean toward side- (y = 0.9, |(1,0.9)| ~ 1.345) invalid at 1.2 -> other side (side+)
    const leansPlusY = { x: 1 - COMBINED, y: 0.3 }
    expectAt(counterRelocationTarget('best', p, d, COMBINED, leansPlusY, 1.2)!, { x: 1, y: 0.2 - COMBINED })
    // nothing valid
    expect(counterRelocationTarget('best', p, d, COMBINED, leansPlusY, 0.5)).toBeNull()
  })

  it('T82: integration — invalid rear falls back to a side; tier stays Best and attacker Kuzushi', () => {
    // Pair shifted +0.2: the pusher ends near (0.2, 0); max 0.8: rear (~0.9) invalid, sides (~0.73) valid.
    const setup = setupAt(-COMBINED / 2 + 0.2, 0, COMBINED / 2 + 0.2, 0, 1.15)
    const { sim, before, after } = counterScenario({ counterTick: 0, setup })
    expect(tierOf(before)).toBe('best')
    expect(B(after).posture.kind).toBe('kuzushi')
    expect(after.counterTransition).toMatchObject({ kind: 'active', tier: 'best' })
    const d = lockedDirection(before)
    const end = pusherEnd(after, d)
    const done = complete(sim)
    // on-axis tie, both sides equally far from center -> side+ = p + perp * R (perp ~ (0,-1))
    expectAt(A(done).position, { x: end.x - d.y * COMBINED, y: end.y + d.x * COMBINED })
    expect(Math.hypot(A(done).position.x, A(done).position.y)).toBeLessThanOrEqual(1.15 - BODY_RADIUS)
    expect(dist(done)).toBeCloseTo(COMBINED, 12)
    expect(done.outcome).toEqual({ kind: 'ongoing' })
  })

  it('T83: any applied relocation is finite, fully inside the ring and at exact contact distance', () => {
    let applied = 0
    let none = 0
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 2 * Math.PI + 0.1
      const d = { x: Math.cos(angle), y: Math.sin(angle) }
      for (const p of [{ x: 0, y: 0 }, { x: 1.2, y: -0.4 }, { x: -0.3, y: 1.6 }]) {
        for (const lean of [-0.2, 0, 0.2]) {
          const defender = { x: p.x + d.x * COMBINED - d.y * lean, y: p.y + d.y * COMBINED + d.x * lean }
          for (const max of [0.4, 1.0, 1.9, 5]) {
            for (const tier of ['best', 'success'] as const) {
              const t = counterRelocationTarget(tier, p, d, COMBINED, defender, max)
              if (!t) {
                none++
                continue
              }
              applied++
              expect(Number.isFinite(t.x) && Number.isFinite(t.y)).toBe(true)
              expect(Math.hypot(t.x, t.y)).toBeLessThanOrEqual(max)
              expect(Math.hypot(t.x - p.x, t.y - p.y)).toBeCloseTo(COMBINED, 12)
            }
          }
        }
      }
    }
    expect(applied).toBeGreaterThan(0)
    expect(none).toBeGreaterThan(0)
  })

  // ACTION-04A4: the transition replaces the overshoot whenever a target exists (D3: entry clears all
  // momentum; the pusher's only motion is the COUNTER_STAGGER_DISTANCE path).
  it('T84: a Best catch starts the transition and clears every velocity; nobody moves on the catch tick', () => {
    const { before, after } = counterScenario({ counterTick: 0 })
    expect(after.counterTransition).toEqual({
      kind: 'active',
      tier: 'best',
      counterUserId: 'a',
      pusherId: 'b',
      ticksRemaining: COUNTER_TRANSITION_TICKS,
    })
    for (const p of after.participants) {
      expect(p.velocity).toEqual({ x: 0, y: 0 })
      expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
    }
    // the catch tick resolves contact first; the Counter user is not relocated on it
    expect(dist(after)).toBeLessThanOrEqual(COMBINED + CONTACT_SLOP)
    expect(Math.abs(A(after).position.x - A(before).position.x)).toBeLessThan(0.05)
  })

  it('T84: large prior momentum is absorbed too (no clamp, no carry)', () => {
    // A fails a Counter (Kuzushi on ticks 12..41); B's Push is active on ticks 35..42 and is boosted by
    // A's Kuzushi; A recovers on tick 42 and Counters B's last active tick (Success).
    const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    const recoverTick = COUNTER_WINDOW_TICKS + KUZUSHI_TICKS
    for (let t = 0; t < recoverTick; t++) sim.step(intents({ counter: t === 0 }, { push: t === recoverTick - 13 }))
    const before = sim.getSnapshot()
    expect(pushPhase(before)).toBe('active')
    expect(speed(B(before).externalVelocity) + COUNTER_OVERSHOOT_SPEED).toBeGreaterThan(MAX_EXTERNAL_SPEED)
    sim.step(intents({ counter: true }))
    const after = sim.getSnapshot()
    expect(after.counterTransition).toMatchObject({ kind: 'active', tier: 'success' })
    for (const p of after.participants) expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
    const done = complete(sim)
    expectAt(B(done).position, pusherEnd(after, lockedDirection(before)))
  })

  it('T85: the pusher stagger is exactly COUNTER_STAGGER_DISTANCE along d, independent of prior momentum', () => {
    const best = counterScenario({ counterTick: 0 }) // no prior pair momentum
    const success = counterScenario({ counterTick: SUCCESS_TICK }) // prior momentum
    expect(speed(A(success.before).externalVelocity)).toBeGreaterThan(0.1)
    expect(COUNTER_STAGGER_DISTANCE).toBe(BODY_RADIUS) // D1: 1.0 R
    for (const run of [best, success]) {
      const d = lockedDirection(run.before)
      const done = complete(run.sim)
      const moved = { x: B(done).position.x - B(run.after).position.x, y: B(done).position.y - B(run.after).position.y }
      expectAt(moved, { x: d.x * COUNTER_STAGGER_DISTANCE, y: d.y * COUNTER_STAGGER_DISTANCE })
    }
  })

  it('T86: after completion both rest exactly (no residual transition velocity or drift)', () => {
    const { sim } = counterScenario({ counterTick: 0 })
    const done = complete(sim)
    for (const p of done.participants) {
      expect(p.velocity).toEqual({ x: 0, y: 0 })
      expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
    }
    for (let k = 0; k < 20; k++) sim.step(IDLE)
    const s = sim.getSnapshot()
    expectFinite(s)
    expect(A(s).position).toEqual(A(done).position)
    expect(B(s).position).toEqual(B(done).position)
  })

  it('T87: the transition uses the locked Push direction, not facing / contact normal', () => {
    const { sim, before, after } = counterScenario({ counterTick: SUCCESS_TICK, lateral: 1 })
    const d = lockedDirection(before)
    const normal = {
      x: (A(before).position.x - B(before).position.x) / dist(before),
      y: (A(before).position.y - B(before).position.y) / dist(before),
    }
    // geometry has rotated away from the locked direction
    expect(Math.abs(Math.atan2(normal.y, normal.x) - Math.atan2(d.y, d.x))).toBeGreaterThan(0.01)
    expect(Math.abs(B(before).facing - Math.atan2(d.y, d.x))).toBeGreaterThan(0.01)
    const end = pusherEnd(after, d)
    const done = complete(sim)
    expectAt(B(done).position, end)
    expectAt(A(done).position, { x: end.x + d.y * COMBINED, y: end.y - d.x * COMBINED }) // side- of d
  })

  it('T88: a failed Counter keeps A1 behavior: self Kuzushi, no relocation, no overshoot', () => {
    const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))
    const start = sim.getSnapshot()
    sim.step(intents({ counter: true }))
    for (let t = 1; t < COUNTER_WINDOW_TICKS + 5; t++) sim.step(IDLE)
    const s = sim.getSnapshot()
    expect(A(s).posture.kind).toBe('kuzushi')
    expect(B(s).posture.kind).toBe('stable')
    expect(A(s).position).toEqual(A(start).position)
    expect(B(s).position).toEqual(B(start).position)
    expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
    expect(B(s).externalVelocity).toEqual({ x: 0, y: 0 })
  })

  it('T89: A1 semantics hold: no same-tick Push gain, exact tiers; Kuzushi paused, then renewed (D2)', () => {
    const best = counterScenario({ counterTick: 0 })
    expect(best.t).toBe(PUSH_STARTUP_TICKS)
    expect(A(best.after).externalVelocity).toEqual({ x: 0, y: 0 }) // the cancelled Push never pushed
    const success = counterScenario({ counterTick: PUSH_STARTUP_TICKS + 3 })
    expect(success.t).toBe(PUSH_STARTUP_TICKS + 3)
    expect(tierOf(success.before)).toBe('success')
    const { sim } = best
    for (let k = 1; k <= COUNTER_TRANSITION_TICKS; k++) {
      sim.step(intents({}, { push: true, move: [0, 1] }))
      expect(B(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(sim.getSnapshot()).facing).toBe(B(best.after).facing)
    }
    expect(sim.getSnapshot().counterTransition).toEqual({ kind: 'none' })
    for (let k = 1; k <= KUZUSHI_TICKS; k++) {
      sim.step(intents({}, { push: true, move: [0, 1] }))
      expect(B(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS - k })
      expect(B(sim.getSnapshot()).facing).toBe(B(best.after).facing)
    }
    sim.step(IDLE)
    expect(B(sim.getSnapshot()).posture.kind).toBe('stable')
  })

  it('T91: mixed Best / Success / fallback scenarios replay identically, finite, no overlap', () => {
    const run = (radius: number) => {
      const sim = new BoutSimulation(setupAt(-COMBINED / 2, 0.05, COMBINED / 2, 0, radius))
      const script: [number, Input, Input][] = [
        [1, { counter: true }, { push: true }],
        [50, {}, {}],
        [1, {}, { move: [-1, 0] }],
        [30, { move: [1, 0] }, {}],
        [1, {}, { push: true }],
        [3, { move: [0, 1] }, {}],
        [5, {}, {}],
        [1, { counter: true }, {}],
        [60, {}, {}],
        [1, { push: true }, {}],
        [4, {}, { counter: true }],
        [60, { move: [-1, 0.5] }, { move: [1, 0] }],
      ]
      // ACTION-06A: in the small fallback rings the later walking segments would now end the bout by
      // ring-out; there only the opening Counter / fallback segments run (and must stay ongoing).
      const steps = radius === 100 ? script : script.slice(0, 2)
      for (const [n, ia, ib] of steps) {
        for (let k = 0; k < n; k++) {
          sim.step(intents(ia, ib))
          expectFinite(sim.getSnapshot())
          expect(dist(sim.getSnapshot())).toBeGreaterThanOrEqual(COMBINED - 1e-9)
          expect(sim.getSnapshot().outcome.kind).toBe('ongoing')
        }
      }
      return sim.getSnapshot()
    }
    for (const radius of [100, 1.25, 1.0]) expect(run(radius)).toEqual(run(radius))
  })
})
