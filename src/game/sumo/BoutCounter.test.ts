import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_BEST_TICKS,
  COUNTER_WINDOW_TICKS,
  KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER,
  KUZUSHI_TICKS,
  PUSH_CHARGE_TICKS,
  PUSH_IMPACT_TICKS,
  PUSH_EXTERNAL_ACCELERATION,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  STOP_DECELERATION,
  TICK_SECONDS,
  counterTier,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from './BoutTypes.ts'

const COMBINED = 2 * BODY_RADIUS
// Upper bound of one Push: a no-contact Push runs its whole charge (ACTION-10B); with contact it is shorter.
const PUSH_TOTAL_TICKS = PUSH_STARTUP_TICKS + PUSH_CHARGE_TICKS + PUSH_RECOVERY_TICKS

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
}

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  const one = (i: Input): ParticipantIntent => ({
    move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
    pushPressed: i.push ?? false,
    tsuppariLeftPressed: false,
    tsuppariRightPressed: false,
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

function stepN(sim: BoutSimulation, n: number, i = IDLE): void {
  for (let k = 0; k < n; k++) sim.step(i)
}

const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const dist = (s: BoutSnapshot) =>
  Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const kind = (s: BoutSnapshot, which: 0 | 1) => s.participants[which].action.kind
const posture = (s: BoutSnapshot, which: 0 | 1) => s.participants[which].posture.kind

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

const touching = () => new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))

// Scenario: B presses Push on tick 0 (active on ticks STARTUP..STARTUP+ACTIVE-1); A presses Counter
// on tick `counterTick`. Returns the tick index on which B entered Kuzushi (or null) and B's action
// as seen just before that tick.
function pushVsCounter(counterTick: number) {
  const sim = touching()
  let resolvedAt: number | null = null
  let attackerBefore = B(sim.getSnapshot()).action
  for (let t = 0; t < PUSH_TOTAL_TICKS + COUNTER_WINDOW_TICKS + 5; t++) {
    const before = B(sim.getSnapshot()).action
    sim.step(intents({ counter: t === counterTick }, { push: t === 0 }))
    if (resolvedAt === null && posture(sim.getSnapshot(), 1) === 'kuzushi') {
      resolvedAt = t
      attackerBefore = before
    }
  }
  return { sim, resolvedAt, attackerBefore }
}

describe('Down Counter + Kuzushi (ACTION-04A1)', () => {
  it('T60: one edge starts exactly one Counter; mashing does not repeat or queue', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ counter: true }))
    expect(A(sim.getSnapshot()).action).toEqual({ kind: 'counter', ticksRemaining: COUNTER_WINDOW_TICKS - 1 })
    let prev = COUNTER_WINDOW_TICKS - 1
    for (let t = 1; t < COUNTER_WINDOW_TICKS; t++) {
      sim.step(intents({ counter: true })) // mashing during the window
      const action = A(sim.getSnapshot()).action
      if (action.kind === 'counter') {
        expect(action.ticksRemaining).toBe(prev - 1)
        prev = action.ticksRemaining
      }
    }
    expect(posture(sim.getSnapshot(), 0)).toBe('kuzushi')
    for (let t = 0; t < KUZUSHI_TICKS; t++) sim.step(intents({ counter: true })) // mashing in Kuzushi
    expect(kind(sim.getSnapshot(), 0)).toBe('idle')
    sim.step(IDLE)
    expect(posture(sim.getSnapshot(), 0)).toBe('stable')
    expect(kind(sim.getSnapshot(), 0)).toBe('idle') // nothing was queued
    sim.step(intents({ counter: true }))
    expect(kind(sim.getSnapshot(), 0)).toBe('counter')
  })

  it('T61: same-tick Push + Counter edges start Push; the Counter is dropped, not queued', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ push: true, counter: true }))
    const action = A(sim.getSnapshot()).action
    expect(action.kind).toBe('push')
    if (action.kind === 'push') expect(action.phase).toBe('startup')
    stepN(sim, PUSH_TOTAL_TICKS + 5)
    expect(kind(sim.getSnapshot(), 0)).toBe('idle')
    expect(posture(sim.getSnapshot(), 0)).toBe('stable')
  })

  it('T62: the window lasts exactly COUNTER_WINDOW_TICKS, then the user enters Kuzushi', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ counter: true }))
    for (let t = 1; t < COUNTER_WINDOW_TICKS; t++) {
      const action = A(sim.getSnapshot()).action
      expect(action.kind).toBe('counter')
      if (action.kind === 'counter') expect(action.ticksRemaining).toBeGreaterThanOrEqual(1)
      sim.step(IDLE)
    }
    expect(kind(sim.getSnapshot(), 0)).toBe('idle')
    expect(A(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
  })

  it('T62: the last window tick can still resolve; one tick later it cannot', () => {
    // Counter on tick 0 covers ticks 0..WINDOW-1. B's Push pressed on tick p is active from p+STARTUP.
    // Read right after the window (ACTION-09B: a later Push force on the failed Counter user would consume its
    // Kuzushi as a follow-up).
    const run = (pushTick: number) => {
      const sim = touching()
      for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === pushTick }))
      return sim.getSnapshot()
    }
    const lastTick = run(COUNTER_WINDOW_TICKS - 1 - PUSH_STARTUP_TICKS)
    expect(B(lastTick).posture.kind).toBe('kuzushi')
    expect(A(lastTick).posture.kind).toBe('stable')
    const tooLate = run(COUNTER_WINDOW_TICKS - PUSH_STARTUP_TICKS)
    expect(A(tooLate).posture.kind).toBe('kuzushi')
  })

  it('T63: Best covers exactly the first COUNTER_BEST_TICKS impact-window ticks', () => {
    expect(COUNTER_BEST_TICKS).toBe(3)
    expect(counterTier(PUSH_IMPACT_TICKS)).toBe('best') // elapsed 0
    expect(counterTier(PUSH_IMPACT_TICKS - 1)).toBe('best') // elapsed 1
    expect(counterTier(PUSH_IMPACT_TICKS - 2)).toBe('best') // elapsed 2
    expect(counterTier(PUSH_IMPACT_TICKS - 3)).toBe('success') // elapsed 3
    expect(counterTier(1)).toBe('success') // last active tick
  })

  it('T63: integration — resolution tick and the attacker state it is classified from', () => {
    for (let c = 0; c <= PUSH_STARTUP_TICKS + 2; c++) {
      const { resolvedAt, attackerBefore } = pushVsCounter(c)
      expect(resolvedAt).toBe(Math.max(c, PUSH_STARTUP_TICKS))
      expect(attackerBefore.kind === 'push' && counterTier(attackerBefore.impactTicksRemaining ?? PUSH_IMPACT_TICKS)).toBe('best')
    }
    const { resolvedAt, attackerBefore } = pushVsCounter(PUSH_STARTUP_TICKS + COUNTER_BEST_TICKS)
    expect(resolvedAt).toBe(PUSH_STARTUP_TICKS + COUNTER_BEST_TICKS)
    expect(attackerBefore.kind === 'push' && counterTier(attackerBefore.impactTicksRemaining ?? PUSH_IMPACT_TICKS)).toBe('success')
  })

  it('T64: a later active tick resolves Success, cancels that tick of Push force and absorbs the pair momentum', () => {
    const c = PUSH_STARTUP_TICKS + 4
    const sim = touching()
    for (let t = 0; t < c; t++) sim.step(intents({}, { push: t === 0 }))
    const e0 = A(sim.getSnapshot()).externalVelocity.x
    expect(e0).toBeLessThan(0) // already being driven back (B pushes toward -x)
    sim.step(intents({ counter: true }))
    const s = sim.getSnapshot()
    expect(B(s).posture.kind).toBe('kuzushi')
    expect(B(s).action.kind).toBe('idle')
    // ACTION-04A4 (D3): the Counter transition starts and absorbs all momentum; no Push gain is applied
    expect(s.counterTransition).toMatchObject({ kind: 'active', tier: 'success', counterUserId: 'a', pusherId: 'b' })
    for (const p of s.participants) {
      expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
      expect(p.velocity).toEqual({ x: 0, y: 0 })
    }
  })

  it('T65: no Push / too early / too late (opponent Recovery) all fail into self Kuzushi', () => {
    const noPush = touching()
    noPush.step(intents({ counter: true }))
    stepN(noPush, COUNTER_WINDOW_TICKS)
    expect(posture(noPush.getSnapshot(), 0)).toBe('kuzushi')

    // too early: B presses Push on tick COUNTER_WINDOW_TICKS, its active starts after the window
    const early = touching()
    for (let t = 0; t < COUNTER_WINDOW_TICKS + 1; t++) {
      early.step(intents({ counter: t === 0 }, { push: t === COUNTER_WINDOW_TICKS }))
    }
    expect(posture(early.getSnapshot(), 0)).toBe('kuzushi')
    expect(posture(early.getSnapshot(), 1)).toBe('stable')

    // too late: Counter pressed on B's first Recovery tick
    const late = pushVsCounter(PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS)
    expect(late.resolvedAt).toBeNull()
    expect(posture(late.sim.getSnapshot(), 1)).toBe('stable')
    // A failed (window expired); it has had time to recover since
    const lateA = touching()
    for (let t = 0; t <= PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS + COUNTER_WINDOW_TICKS - 1; t++) {
      lateA.step(intents({ counter: t === PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS }, { push: t === 0 }))
    }
    expect(posture(lateA.getSnapshot(), 0)).toBe('kuzushi')
  })

  it('T66: a Counter can start before Contact and resolve when Contact + active occur', () => {
    const gap = 0.03
    const sim = new BoutSimulation(setupAt(-COMBINED / 2 - gap, 0, COMBINED / 2, 0))
    sim.step(intents({}, { push: true }))
    stepN(sim, PUSH_STARTUP_TICKS - 2)
    expect(dist(sim.getSnapshot())).toBeGreaterThan(COMBINED + 0.01) // not in contact yet
    sim.step(intents({ counter: true }))
    for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(IDLE)
    expect(posture(sim.getSnapshot(), 1)).toBe('kuzushi')
    expect(posture(sim.getSnapshot(), 0)).toBe('stable')

    // too far: the short step never reaches contact -> Fail
    const far = new BoutSimulation(setupAt(-COMBINED / 2 - 0.3, 0, COMBINED / 2, 0))
    far.step(intents({}, { push: true }))
    stepN(far, PUSH_STARTUP_TICKS - 2)
    far.step(intents({ counter: true }))
    for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) far.step(IDLE)
    expect(posture(far.getSnapshot(), 0)).toBe('kuzushi')
    expect(posture(far.getSnapshot(), 1)).toBe('stable')
  })

  // ACTION-04A2 replaced the A1-only "no relocation" assertions here; positions are covered by T78+.
  it('T67: Best and Success both put the attacker into Kuzushi; defender idle/stable', () => {
    for (const c of [PUSH_STARTUP_TICKS, PUSH_STARTUP_TICKS + COUNTER_BEST_TICKS + 1]) {
      const sim = touching()
      for (let t = 0; t <= c; t++) sim.step(intents({ counter: t === c }, { push: t === 0 }))
      const s = sim.getSnapshot()
      expect(B(s).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(s).action).toEqual({ kind: 'idle' })
      expect(A(s).action).toEqual({ kind: 'idle' })
      expect(A(s).posture).toEqual({ kind: 'stable' })
      expect(dist(s)).toBeCloseTo(COMBINED, 9)
    }
  })

  it('T68: newly entered Kuzushi lasts exactly KUZUSHI_TICKS full ticks', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ counter: true }))
    stepN(sim, COUNTER_WINDOW_TICKS - 1)
    expect(A(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    for (let k = 1; k <= KUZUSHI_TICKS; k++) {
      sim.step(intents({ push: true })) // ignored: this is a full Kuzushi tick
      expect(A(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS - k })
      expect(kind(sim.getSnapshot(), 0)).toBe('idle')
    }
    sim.step(intents({ push: true })) // recovered at the start of this tick: the edge is accepted
    expect(posture(sim.getSnapshot(), 0)).toBe('stable')
    expect(kind(sim.getSnapshot(), 0)).toBe('push')
  })

  it('T69: Kuzushi ignores Push / Counter / move intent; Counter brakes by the grounded rule', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    stepN(sim, 40, intents({ move: [0, 1] })) // A walking at full speed
    const v0 = A(sim.getSnapshot()).velocity.y
    sim.step(intents({ counter: true, move: [0, 1] }))
    // braked (not zeroed) by STOP_DECELERATION despite the held move key
    expect(A(sim.getSnapshot()).velocity.y).toBeCloseTo(v0 - STOP_DECELERATION * TICK_SECONDS, 12)
    stepN(sim, COUNTER_WINDOW_TICKS - 1, intents({ move: [0, 1] }))
    expect(posture(sim.getSnapshot(), 0)).toBe('kuzushi')
    const p0 = A(sim.getSnapshot()).position
    for (let k = 0; k < KUZUSHI_TICKS; k++) {
      sim.step(intents({ move: [1, 0], push: true, counter: true }))
      const a = A(sim.getSnapshot())
      expect(a.velocity).toEqual({ x: 0, y: 0 })
      expect(a.position).toEqual(p0)
      expect(a.action.kind).toBe('idle')
    }
    sim.step(intents({ move: [1, 0] })) // stable again: steering resumes
    expect(A(sim.getSnapshot()).velocity.x).toBeGreaterThan(0)
  })

  it('T70: a Kuzushi participant keeps its facing; the stable one still auto-faces', () => {
    const sim = new BoutSimulation(setupAt(-1, 0, 1, 0))
    sim.step(intents({ counter: true }))
    stepN(sim, COUNTER_WINDOW_TICKS - 1)
    expect(posture(sim.getSnapshot(), 0)).toBe('kuzushi')
    const frozen = A(sim.getSnapshot()).facing
    for (let k = 0; k < KUZUSHI_TICKS; k++) {
      sim.step(intents({}, { move: [0, -1] })) // B walks around
      const s = sim.getSnapshot()
      expect(A(s).facing).toBe(frozen)
      expect(B(s).facing).toBeCloseTo(
        Math.atan2(A(s).position.y - B(s).position.y, A(s).position.x - B(s).position.x),
        12,
      )
    }
    expect(B(sim.getSnapshot()).position.y).toBeLessThan(-0.3)
    sim.step(IDLE) // recovers at the start of this tick
    const s = sim.getSnapshot()
    expect(A(s).posture.kind).toBe('stable')
    expect(A(s).facing).toBeCloseTo(
      Math.atan2(B(s).position.y - A(s).position.y, B(s).position.x - A(s).position.x),
      12,
    )
    expect(A(s).facing).not.toBe(frozen)
  })

  it('T71: a Kuzushi defender receives exactly KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER times the Push (and it is consumed)', () => {
    // A fails a Counter (Kuzushi from tick WINDOW on); B's Push pressed then is active while A is in Kuzushi.
    const run = (aCounters: boolean) => {
      const sim = touching()
      for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({ counter: aCounters && t === 0 }))
      sim.step(intents({}, { push: true }))
      stepN(sim, PUSH_STARTUP_TICKS) // first active tick resolved
      return sim.getSnapshot()
    }
    const stable = run(false)
    const kuzushi = run(true)
    expect(A(stable).posture.kind).toBe('stable')
    expect(A(kuzushi).posture.kind).toBe('stable') // ACTION-09B: the first Push force consumes the Kuzushi
    expect(A(stable).externalVelocity.x).toBeCloseTo(-PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS, 12)
    expect(A(kuzushi).externalVelocity.x).toBeCloseTo(
      -PUSH_EXTERNAL_ACCELERATION * KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER * TICK_SECONDS,
      12,
    )
    expect(B(kuzushi).externalVelocity).toEqual(A(kuzushi).externalVelocity)
  })

  it('T72: simultaneous Counters with no Push both expire into symmetric Kuzushi', () => {
    const sim = touching()
    sim.step(intents({ counter: true }, { counter: true }))
    for (let t = 1; t < COUNTER_WINDOW_TICKS + KUZUSHI_TICKS + 3; t++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expectFinite(s)
      expect(A(s).posture).toEqual(B(s).posture)
      expect(A(s).position.x + B(s).position.x).toBeCloseTo(0, 12)
      if (t === COUNTER_WINDOW_TICKS - 1) expect(A(s).posture.kind).toBe('kuzushi')
    }
    expect(posture(sim.getSnapshot(), 0)).toBe('stable')
  })

  it('T73: equal simultaneous Push between stable participants still cancels', () => {
    const sim = touching()
    sim.step(intents({ push: true }, { push: true }))
    for (let k = 1; k < PUSH_TOTAL_TICKS + 10; k++) {
      sim.step(IDLE)
      const s = sim.getSnapshot()
      expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(B(s).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(s).posture.kind).toBe('stable')
      expect(B(s).posture.kind).toBe('stable')
    }
  })

  it('T76: mixed Counter / Push sequences replay identically, stay finite, never overlap', () => {
    const run = () => {
      const sim = new BoutSimulation(setupAt(-0.6, 0.1, 0.4, -0.05))
      const script: [number, Input, Input][] = [
        [1, { counter: true }, { push: true }],
        [20, { move: [1, 0] }, { move: [-1, 0.3] }],
        [1, { push: true }, {}],
        [7, {}, {}],
        [1, {}, { counter: true }],
        [40, { move: [0.5, 0.5] }, { move: [-1, 0] }],
        [1, { push: true, counter: true }, { push: true }],
        [30, { counter: true }, { move: [0, 1] }],
        [1, {}, { push: true }],
        [60, { move: [-1, 0] }, {}],
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

  it('snapshot posture is an isolated copy', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ counter: true }))
    stepN(sim, COUNTER_WINDOW_TICKS - 1)
    const p = A(sim.getSnapshot()).posture as unknown as { ticksRemaining: number }
    p.ticksRemaining = 99
    expect(A(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
  })
})
