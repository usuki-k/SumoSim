import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  KUZUSHI_TICKS,
  PUSH_IMPACT_TICKS,
  PUSH_STARTUP_TICKS,
  TSUPPARI_IMPULSE,
  TSUPPARI_KUZUSHI_BUILDUP,
  TSUPPARI_STARTUP_TICKS,
  isGripEligible,
  resolveFreeGripContest,
} from './BoutSimulation.ts'
import * as simulationModule from './BoutSimulation.ts'
import type { ArenaSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'

// ACTION-11C: Grip lunge (8-tick reach, minimum attempt 4, contact success) and the explicit Grip contest
// (Tsuppari > Grip, Push impact > Grip, Grip > Counter, Grip / Grip neutral).

const COMBINED = 2 * BODY_RADIUS
const RING: ArenaSetup = { radius: 2.275, tokudawara: { depth: 0.1194375, halfAngle: Math.PI / 20 } }

interface Input {
  move?: [number, number]
  push?: boolean
  left?: boolean
  right?: boolean
  counter?: boolean
  grip?: boolean
}
const one = (i: Input = {}): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  tsuppariLeftPressed: i.left ?? false,
  tsuppariRightPressed: i.right ?? false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: false,
})
const intents = (a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
const IDLE = intents()

function makeSim(ax: number, bx: number, opts: { ay?: number; by?: number; arena?: ArenaSetup; swapOrder?: boolean } = {}) {
  const pa = { id: 'a', position: { x: ax, y: opts.ay ?? 0 } }
  const pb = { id: 'b', position: { x: bx, y: opts.by ?? 0 } }
  return new BoutSimulation({ arena: opts.arena ?? { radius: 100 }, participants: opts.swapOrder ? [pb, pa] : [pa, pb] })
}
const gapSim = (gap: number) => makeSim(-gap / 2, gap / 2)
const P = (s: BoutSnapshot, id: ParticipantId) => s.participants.find((p) => p.id === id)!
const A = (s: BoutSnapshot) => P(s, 'a')
const B = (s: BoutSnapshot) => P(s, 'b')
const dist = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const stepN = (sim: BoutSimulation, n: number, i = IDLE) => {
  for (let k = 0; k < n; k++) sim.step(i)
}
const gripOf = (p: ParticipantState) => (p.action.kind === 'grip' ? p.action : null)

// ---- contest timelines labelled by role (G = gripper, O = other), so ids / array order can be swapped -------------

interface ContestCase {
  gap: number
  base: number // Grip press tick; every label is relative to it
  d: number // the other participant's press tick, relative to base
  other: Input
  n?: number
}
interface Variant {
  gripperId: ParticipantId
  swapOrder: boolean
}
const VARIANTS: Variant[] = [
  { gripperId: 'a', swapOrder: false },
  { gripperId: 'b', swapOrder: false },
  { gripperId: 'a', swapOrder: true },
  { gripperId: 'b', swapOrder: true },
]

interface ContestRun {
  readonly events: string
  readonly snapshots: BoutSnapshot[]
}

function runContest(c: ContestCase, v: Variant): ContestRun {
  const otherId: ParticipantId = v.gripperId === 'a' ? 'b' : 'a'
  // The gripper always stands on the left: only ids and the array order change between variants.
  const pos: Record<ParticipantId, number> = { [v.gripperId]: -c.gap / 2, [otherId]: c.gap / 2 }
  const sim = makeSim(pos.a, pos.b, { swapOrder: v.swapOrder })
  const snapshots: BoutSnapshot[] = [sim.getSnapshot()]
  const events: string[] = []
  const role = (id: ParticipantId) => (id === v.gripperId ? 'G' : 'O')
  for (let t = 0; t < c.base + (c.n ?? 40); t++) {
    const input: Record<ParticipantId, Input> = {
      [v.gripperId]: t === c.base ? { grip: true } : {},
      [otherId]: t === c.base + c.d ? c.other : {},
    }
    sim.step(new Map([['a', one(input.a)], ['b', one(input.b)]]))
    const prev = snapshots[snapshots.length - 1]
    const s = sim.getSnapshot()
    snapshots.push(s)
    const rel = t - c.base
    const tick: string[] = [] // sorted per tick, so id / array order never decides the listing order
    for (const id of ['a', 'b'] as const) {
      const p = P(s, id)
      const q = P(prev, id)
      if (p.action.kind === 'tsuppari' && p.action.strike !== 'pending' && !(q.action.kind === 'tsuppari' && q.action.strike !== 'pending')) {
        tick.push(`${rel}:${role(id)} tsu-${p.action.strike}`)
      }
      if (p.action.kind === 'push' && p.action.impactTicksRemaining !== null && !(q.action.kind === 'push' && q.action.impactTicksRemaining !== null)) {
        tick.push(`${rel}:${role(id)} impact`)
      }
      const g = gripOf(p)
      const h = gripOf(q)
      if (g?.phase === 'recovery' && h?.phase !== 'recovery' && prev.engagement.kind === 'free') {
        // a defeated reach enters recovery during resolution (that tick already counts; possibly on its press tick);
        // an expired one at the end of the tick
        tick.push(`${rel}:${role(id)} ${g.ticksRemaining === GRIP_RECOVERY_TICKS ? 'whiff' : 'cancel'}`)
      }
      if (p.posture.kind !== q.posture.kind) tick.push(`${rel}:${role(id)} ${p.posture.kind}`)
    }
    if (s.engagement.kind === 'grappled' && prev.engagement.kind === 'free') {
      const adv = s.engagement.advantage
      tick.push(`${rel}:grapple ${adv.kind === 'neutral' ? 'neutral' : 'morozashi ' + role(adv.holderId)}`)
    }
    if (s.counterTransition.kind !== prev.counterTransition.kind) tick.push(`${rel}:transition ${s.counterTransition.kind}`)
    events.push(...tick.sort())
    if (s.outcome.kind !== 'ongoing') break
  }
  return { events: events.join(', '), snapshots }
}

// Every variant must produce the same role-labelled timeline; returns it with the first variant's snapshots.
function contest(c: ContestCase): ContestRun {
  const runs = VARIANTS.map((v) => runContest(c, v))
  for (const r of runs) expect(r.events, `gap ${c.gap} d ${c.d}`).toBe(runs[0].events)
  return runs[0]
}

// Invariants that must hold for every contest cell (participant 'a' is the gripper in the first variant).
function expectContestInvariants(run: ContestRun, label: string): void {
  const { snapshots } = run
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const s = snapshots[i]
    if (s.engagement.kind === 'grappled' && prev.engagement.kind === 'free') {
      // a Grip grapple: some eligible Grip reach on the resolving tick, and the target was takeable
      const eligible = prev.participants.filter((p) => {
        const g = gripOf(p)
        return g?.phase === 'reach' && GRIP_REACH_TICKS - g.ticksRemaining >= GRIP_MIN_ATTEMPT_TICKS
      })
      expect(eligible.length, label).toBeGreaterThan(0)
      for (const p of prev.participants) {
        expect(['idle', 'counter', 'grip'], label).toContain(p.action.kind)
        if (p.action.kind === 'grip') expect(p.action.phase, label).toBe('reach')
      }
      expect(dist(s), label).toBeCloseTo(COMBINED, 9)
    }
  }
}

describe('Grip lunge timing / movement (ACTION-11C)', () => {
  it('G1-G3: constants', () => {
    expect(GRIP_REACH_TICKS).toBe(8)
    expect(GRIP_MIN_ATTEMPT_TICKS).toBe(4)
    expect(GRIP_RECOVERY_TICKS).toBe(12)
    // the margin-based Grip range is gone
    expect('GRIP_RANGE_MARGIN' in simulationModule).toBe(false)
  })

  it('G4-G6 / G10: open-space lunge ~0.100 m in reach, ~0.1267 m with braking, peak ~1.333 m/s; whiff -> full recovery', () => {
    const sim = gapSim(6)
    const x0 = A(sim.getSnapshot()).position.x
    sim.step(intents({ grip: true }))
    let peak = 0
    let reach = 1
    while (gripOf(A(sim.getSnapshot()))?.phase === 'reach') {
      sim.step(IDLE)
      reach++
    }
    // the last reach tick has the highest speed (its Snapshot is already in recovery)
    peak = Math.hypot(A(sim.getSnapshot()).velocity.x, A(sim.getSnapshot()).velocity.y)
    // the reach moved for GRIP_REACH_TICKS ticks (the press tick included): sum k/6 m/s * 1/60 s = 0.100 m
    const afterReach = A(sim.getSnapshot())
    expect(reach).toBe(GRIP_REACH_TICKS)
    expect(afterReach.action).toMatchObject({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS })
    expect(afterReach.position.x - x0).toBeCloseTo(0.1, 9)
    expect(peak).toBeCloseTo(4 / 3, 9)
    let recovery = 0
    while (A(sim.getSnapshot()).action.kind === 'grip') {
      sim.step(IDLE)
      recovery++
    }
    expect(recovery).toBe(GRIP_RECOVERY_TICKS)
    expect(A(sim.getSnapshot()).position.x - x0).toBeCloseTo(0.12666666666666668, 9)
    expect(A(sim.getSnapshot()).velocity).toEqual({ x: 0, y: 0 })
    expect(A(sim.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
  })

  it('G7 / G8 / G9: the press-time direction and facing are locked through reach (no homing); recovery turns again', () => {
    const sim = gapSim(1.2)
    sim.step(intents({ grip: true }, { move: [0, 1] }))
    const g0 = gripOf(A(sim.getSnapshot()))!
    expect(g0.direction).toEqual({ x: 1, y: 0 })
    while (gripOf(A(sim.getSnapshot()))?.phase === 'reach') {
      const a = A(sim.getSnapshot())
      expect(a.facing).toBe(0)
      expect(a.position.y).toBe(0)
      expect(gripOf(a)!.direction).toEqual({ x: 1, y: 0 })
      sim.step(intents({ move: [0, -1] }, { move: [0, 1] })) // WASD is ignored during reach
    }
    expect(B(sim.getSnapshot()).position.y).toBeGreaterThan(0.05)
    const s = sim.getSnapshot()
    expect(A(s).action).toMatchObject({ kind: 'grip', phase: 'recovery' })
    expect(A(s).facing).toBeCloseTo(Math.atan2(B(s).position.y - A(s).position.y, B(s).position.x - A(s).position.x), 12)
    // recovery brakes (zero intent): WASD still ignored
    sim.step(intents({ move: [0, -1] }))
    expect(A(sim.getSnapshot()).velocity.y).toBe(0)
  })

  it('Grip Snapshot direction is a deep copy', () => {
    const sim = gapSim(2)
    sim.step(intents({ grip: true }))
    const s = sim.getSnapshot()
    ;(gripOf(A(s))!.direction as { x: number }).x = 42
    expect(gripOf(A(sim.getSnapshot()))!.direction).toEqual({ x: 1, y: 0 })
  })
})

describe('Minimum attempt visibility (ACTION-11C)', () => {
  it('V1-V4: a Grip started in contact cannot land before elapsed 4; it lands on elapsed 4 after 4 reach Snapshots', () => {
    const sim = gapSim(COMBINED)
    sim.step(intents({ grip: true }))
    const reachSnapshots: number[] = []
    for (let elapsed = 1; elapsed <= GRIP_MIN_ATTEMPT_TICKS; elapsed++) {
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('free') // V1 (press tick) / V2
      expect(gripOf(A(s))?.phase).toBe('reach')
      reachSnapshots.push(gripOf(A(s))!.ticksRemaining)
      expect(isGripEligible(A(s))).toBe(elapsed === GRIP_MIN_ATTEMPT_TICKS)
      sim.step(IDLE)
    }
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } }) // V3
    expect(reachSnapshots).toEqual([7, 6, 5, 4]) // V4: 4 attempt Snapshots
  })

  it('V5: a Tsuppari hit or a Push impact can defeat the attempt before it is eligible', () => {
    // Tsuppari pressed 4 ticks before the Grip: the hit lands on reach elapsed 2
    const tsu = contest({ gap: COMBINED, base: 10, d: -4, other: { left: true } })
    expect(tsu.events).toBe('2:G cancel, 2:O tsu-hit')
    // Push pressed 4 ticks before in contact: its impact opens on elapsed 2
    const push = contest({ gap: COMBINED, base: 10, d: -4, other: { push: true } })
    expect(push.events.startsWith('2:G cancel, 2:O impact')).toBe(true)
  })
})

describe('Contact success (ACTION-11C)', () => {
  it('C1 / C2: an eligible Grip without contact does not succeed, even inside the old 0.79 m range', () => {
    const facts = (x: number, action: ParticipantState['action']) => ({
      id: x < 0 ? 'a' : 'b',
      action,
      posture: { kind: 'stable' } as const,
      position: { x, y: 0 },
      bodyRadius: BODY_RADIUS,
    })
    const eligibleReach = { kind: 'grip', phase: 'reach', ticksRemaining: GRIP_REACH_TICKS - GRIP_MIN_ATTEMPT_TICKS, direction: { x: 1, y: 0 } } as const
    for (const gap of [0.75, 0.79]) {
      const gripper = facts(-gap / 2, eligibleReach)
      const target = facts(gap / 2, { kind: 'idle' })
      expect(resolveFreeGripContest(gripper, target, false)).toEqual({ cancelled: [], grapple: null })
      expect(resolveFreeGripContest(gripper, target, true)).toEqual({ cancelled: [], grapple: { kind: 'neutral' } })
    }
    // Simulation: a target backing away at full speed keeps out of contact -> whiff, although 0.75 < 0.79
    const sim = gapSim(0.75)
    sim.step(intents({ grip: true }, { move: [1, 0] }))
    for (let t = 1; t < GRIP_REACH_TICKS + 2; t++) sim.step(intents({}, { move: [1, 0] }))
    expect(sim.getSnapshot().engagement.kind).toBe('free')
    expect(A(sim.getSnapshot()).action).toMatchObject({ kind: 'grip', phase: 'recovery' })
  })

  it('C3: ordinary contact success has no bond snap; the stationary target never moves', () => {
    for (const gap of [0.7, 0.72, 0.75, 0.78, 0.8]) {
      const sim = gapSim(gap)
      sim.step(intents({ grip: true }))
      let prev = sim.getSnapshot()
      for (let t = 1; t < GRIP_REACH_TICKS && sim.getSnapshot().engagement.kind === 'free'; t++) {
        prev = sim.getSnapshot()
        sim.step(IDLE)
        expect(B(sim.getSnapshot()).position.x).toBeCloseTo(gap / 2, 15) // only the final bond may add float noise
        expect(B(sim.getSnapshot()).position.y).toBeCloseTo(0, 15)
      }
      const s = sim.getSnapshot()
      expect(s.engagement.kind, `gap ${gap}`).toBe('grappled')
      expect(B(s).position.x).toBeCloseTo(gap / 2, 12)
      expect(dist(s)).toBeCloseTo(COMBINED, 12)
      // the gripper moves by at most its own lunge step on the grapple tick (no attach jump)
      expect(Math.abs(A(s).position.x - A(prev).position.x)).toBeLessThanOrEqual((4 / 3) / 60 + 1e-12)
    }
  })

  it('C4: a stationary target is reachable up to ~0.80 m through the lunge (not beyond)', () => {
    const lands = (gap: number) => {
      const sim = gapSim(gap)
      sim.step(intents({ grip: true }))
      stepN(sim, GRIP_REACH_TICKS)
      return sim.getSnapshot().engagement.kind === 'grappled'
    }
    expect(lands(0.8)).toBe(true)
    expect(lands(0.801)).toBe(true)
    expect(lands(0.803)).toBe(false)
    expect(lands(0.85)).toBe(false)
  })

  it('C5: glancing contact (the target side-steps during the lunge) still succeeds', () => {
    const sim = gapSim(0.78)
    sim.step(intents({ grip: true }, { move: [0, 1] }))
    let t = 1
    while (sim.getSnapshot().engagement.kind === 'free' && t < GRIP_REACH_TICKS) {
      sim.step(intents({}, { move: [0, 1] }))
      t++
    }
    const s = sim.getSnapshot()
    expect(s.engagement.kind).toBe('grappled')
    expect(B(s).position.y).toBeGreaterThan(0.01)
    expect(A(s).position.y).toBeCloseTo(0, 2) // the gripper kept its straight lunge
  })
})

describe('Tsuppari > Grip (ACTION-11C)', () => {
  it('TG1-TG5: the hit cancels a reaching Grip into full recovery; impulse and buildup are those of an ordinary hit', () => {
    const run = (gripping: boolean) => {
      const sim = gapSim(0.75)
      sim.step(intents({ grip: gripping }, { left: true }))
      stepN(sim, TSUPPARI_STARTUP_TICKS - 1)
      const before = sim.getSnapshot()
      sim.step(IDLE) // hit tick
      return { before, after: sim.getSnapshot(), sim }
    }
    const g = run(true)
    const idle = run(false)
    expect(gripOf(A(g.before))?.phase).toBe('reach')
    expect(B(g.after).action).toMatchObject({ kind: 'tsuppari', strike: 'hit' })
    expect(A(g.after).action).toMatchObject({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS - 1 }) // TG1 / TG2
    expect(g.after.engagement.kind).toBe('free') // TG3
    // TG4: the same impulse as on an idle receiver (2.13 m/s; the tick's external decay ran before the hit)
    expect(A(g.after).externalVelocity).toEqual(A(idle.after).externalVelocity)
    expect(-A(g.after).externalVelocity.x).toBeCloseTo(TSUPPARI_IMPULSE, 12)
    expect(B(g.after).tsuppariBuildup).toBe(1) // TG5
    expect(B(idle.after).tsuppariBuildup).toBe(1)
    // the cancel tick is the first of GRIP_RECOVERY_TICKS recovery ticks (as after a release)
    stepN(g.sim, GRIP_RECOVERY_TICKS - 2)
    expect(A(g.sim.getSnapshot()).action.kind).toBe('grip')
    g.sim.step(IDLE)
    expect(A(g.sim.getSnapshot()).action.kind).toBe('idle')
    expect(A(g.sim.getSnapshot()).posture.kind).toBe('stable') // no Kuzushi just for losing the Grip
  })

  it('TG6: the 6th (Kuzushi) hit on a reaching gripper still gives Kuzushi and resets the buildup', () => {
    const sim = gapSim(COMBINED)
    // five ordinary hits; A walks back into contact between them
    for (let t = 0; t < 2000 && B(sim.getSnapshot()).tsuppariBuildup < TSUPPARI_KUZUSHI_BUILDUP; t++) {
      const s = sim.getSnapshot()
      const b = B(s)
      const ready = b.action.kind === 'idle' && dist(s) <= 0.75
      const hand = b.tsuppariCooldown.left === 0 ? { left: true } : b.tsuppariCooldown.right === 0 ? { right: true } : {}
      sim.step(intents(dist(s) > 0.72 ? { move: [1, 0] } : {}, ready ? hand : {}))
    }
    expect(B(sim.getSnapshot()).tsuppariBuildup).toBe(TSUPPARI_KUZUSHI_BUILDUP)
    // close in, wait for A idle / still and a ready hand, then Grip and Tsuppari on the same tick
    for (let t = 0; t < 400; t++) {
      const s = sim.getSnapshot()
      const settled = A(s).action.kind === 'idle' && B(s).action.kind === 'idle' && A(s).velocity.x === 0 && A(s).externalVelocity.x === 0
      if (settled && dist(s) <= 0.72 && B(s).tsuppariCooldown.left === 0) break
      sim.step(intents(dist(s) > 0.71 ? { move: [1, 0] } : {}))
    }
    sim.step(intents({ grip: true }, { left: true }))
    stepN(sim, TSUPPARI_STARTUP_TICKS)
    const s = sim.getSnapshot()
    expect(B(s).action).toMatchObject({ kind: 'tsuppari', strike: 'hit' })
    expect(A(s).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    expect(A(s).action).toEqual({ kind: 'idle' }) // Kuzushi cancels every action (recovery included)
    expect(B(s).tsuppariBuildup).toBe(0)
    expect(s.engagement.kind).toBe('free')
  })
})

describe('Push > Grip (ACTION-11C)', () => {
  it('PG1 / PG7: a Push in startup neither cancels nor can be taken (the Grip whiffs)', () => {
    const r = contest({ gap: COMBINED, base: 10, d: 2, other: { push: true } })
    expect(r.events.startsWith('7:G whiff, 8:O impact')).toBe(true)
  })

  it('PG2: the pre-impact charge (no contact) does not cancel the Grip', () => {
    const r = contest({ gap: 1.6, base: 20, d: -12, other: { push: true } })
    expect(r.events.startsWith('7:G whiff, 17:O impact')).toBe(true)
  })

  it('PG3 / PG4: the impact tick in contact cancels the reaching Grip into full recovery', () => {
    const r = contest({ gap: COMBINED, base: 10, d: 0, other: { push: true } })
    expect(r.events.startsWith(`${PUSH_STARTUP_TICKS}:G cancel, ${PUSH_STARTUP_TICKS}:O impact`)).toBe(true)
    const s = r.snapshots[10 + PUSH_STARTUP_TICKS + 1]
    expect(A(s).action).toMatchObject({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS - 1 })
    expect(A(s).posture.kind).toBe('stable')
  })

  it('PG5: the Push force on a defeated gripper is exactly the force on an idle target', () => {
    const series = (grip: boolean) => {
      const sim = gapSim(1.2)
      const out: number[] = []
      let opened = false
      for (let t = 0; t < 60; t++) {
        const before = A(sim.getSnapshot()).externalVelocity.x
        sim.step(intents({ grip: grip && t === 4 }, { push: t === 0 }))
        const b = B(sim.getSnapshot())
        if (b.action.kind === 'push' && b.action.impactTicksRemaining !== null) opened = true
        if (opened && out.length < PUSH_IMPACT_TICKS) out.push(A(sim.getSnapshot()).externalVelocity.x - before)
      }
      return out
    }
    const g = series(true)
    expect(g).toHaveLength(PUSH_IMPACT_TICKS)
    expect(g).toEqual(series(false))
  })

  it('PG6 / PG7: Push recovery does not cancel and cannot be taken', () => {
    // B's Push impact ends before the Grip; its recovery covers the whole eligible reach
    const r = contest({ gap: COMBINED, base: 20, d: -16, other: { push: true } })
    expect(r.events).toBe('-10:O impact, 7:G whiff')
  })
})

describe('Grip > Counter (ACTION-11C)', () => {
  it('GC1-GC4: an eligible Grip in contact takes an active Counter: neutral, Counter cancelled, no Kuzushi / transition', () => {
    const r = contest({ gap: 0.75, base: 10, d: 0, other: { counter: true } })
    expect(r.events).toBe('5:grapple neutral')
    const s = r.snapshots[10 + 5 + 1]
    expect(B(s).action).toEqual({ kind: 'idle' })
    for (const snap of r.snapshots) {
      expect(B(snap).posture.kind).toBe('stable')
      expect(snap.counterTransition.kind).toBe('none')
    }
  })

  it('GC5: a Counter that already timed out into Kuzushi gives the gripper Morozashi', () => {
    const r = contest({ gap: 0.75, base: 20, d: -12, other: { counter: true } })
    expect(r.events).toBe('-1:O kuzushi, 5:O stable, 5:grapple morozashi G')
  })
})

describe('Grip vs Grip (ACTION-11C)', () => {
  it('GG1 / GG3: both pressed together in contact: nothing before elapsed 4, then one symmetric neutral grapple', () => {
    const sim = gapSim(COMBINED)
    sim.step(intents({ grip: true }, { grip: true }))
    for (let k = 1; k < GRIP_MIN_ATTEMPT_TICKS; k++) {
      expect(sim.getSnapshot().engagement.kind).toBe('free')
      sim.step(IDLE)
    }
    expect(sim.getSnapshot().engagement.kind).toBe('free')
    sim.step(IDLE)
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  })

  it('GG2: one eligible Grip takes an opponent that is still reaching (not yet eligible): neutral', () => {
    // B pressed 2 ticks earlier: B is eligible on A's elapsed 2; no timing hole
    const r = contest({ gap: COMBINED, base: 10, d: -2, other: { grip: true } })
    expect(r.events).toBe('2:grapple neutral')
    for (let d = -9; d <= 9; d++) {
      expect(contest({ gap: COMBINED, base: 10, d, other: { grip: true } }).events).toMatch(/grapple neutral/)
    }
  })
})

describe('Idle / Kuzushi targets (ACTION-11C)', () => {
  it('IK1: eligible Grip + idle + contact -> neutral', () => {
    expect(contest({ gap: 0.75, base: 10, d: 100, other: {} }).events).toBe('5:grapple neutral')
  })

  it('IK2 / IK3: Kuzushi target -> Morozashi; the Kuzushi is consumed only on the grapple tick', () => {
    const r = contest({ gap: 0.8, base: 20, d: -20, other: { counter: true } })
    expect(r.events).toBe('-9:O kuzushi, 7:O stable, 7:grapple morozashi G')
    for (let t = 20; t < 20 + 7; t++) expect(B(r.snapshots[t + 1]).posture.kind).toBe('kuzushi') // lunge + contact
  })

  it('IK4: a Grip that cannot reach the Kuzushi target consumes nothing', () => {
    const r = contest({ gap: 0.9, base: 20, d: -20, other: { counter: true } })
    expect(r.events).toBe('-9:O kuzushi, 7:G whiff')
    expect(B(r.snapshots[r.snapshots.length - 1]).posture.kind).toBe('kuzushi')
  })
})

describe('resolveFreeGripContest (pure helper, ACTION-11C)', () => {
  const at = (id: ParticipantId, x: number, action: ParticipantState['action'], kuzushi = false) => ({
    id,
    action,
    posture: kuzushi ? ({ kind: 'kuzushi', ticksRemaining: 10 } as const) : ({ kind: 'stable' } as const),
    position: { x, y: 0 },
    bodyRadius: BODY_RADIUS,
  })
  const reach = (elapsed: number) => ({ kind: 'grip', phase: 'reach', ticksRemaining: GRIP_REACH_TICKS - elapsed, direction: { x: 1, y: 0 } }) as const
  const tsuHitTick = { kind: 'tsuppari', hand: 'left', phase: 'active', ticksRemaining: 1, strike: 'pending' } as const
  const pushImpact = { kind: 'push', phase: 'active', ticksRemaining: 20, direction: { x: -1, y: 0 }, impactTicksRemaining: 5 } as const
  const pushCharge = { ...pushImpact, impactTicksRemaining: null }
  const pushStartup = { ...pushImpact, phase: 'startup', ticksRemaining: 3, impactTicksRemaining: null } as const
  const pushRecovery = { ...pushImpact, phase: 'recovery', ticksRemaining: 3, impactTicksRemaining: 0 } as const
  const counter = { kind: 'counter', ticksRemaining: 6 } as const
  const both = (a: ReturnType<typeof at>, b: ReturnType<typeof at>, contact: boolean) => {
    const r = resolveFreeGripContest(a, b, contact)
    expect(resolveFreeGripContest(b, a, contact)).toEqual({ ...r, cancelled: [...r.cancelled].reverse() }) // argument order
    return r
  }

  it('the full pair table from one state, symmetric in its arguments', () => {
    const g = at('a', -0.35, reach(4))
    expect(both(g, at('b', 0.35, { kind: 'idle' }), true)).toEqual({ cancelled: [], grapple: { kind: 'neutral' } })
    expect(both(g, at('b', 0.35, { kind: 'idle' }, true), true)).toEqual({ cancelled: [], grapple: { kind: 'morozashi', holderId: 'a' } })
    expect(both(g, at('b', 0.35, counter), true)).toEqual({ cancelled: [], grapple: { kind: 'neutral' } })
    expect(both(g, at('b', 0.35, reach(0)), true)).toEqual({ cancelled: [], grapple: { kind: 'neutral' } })
    expect(both(g, at('b', 0.35, reach(6)), true)).toEqual({ cancelled: [], grapple: { kind: 'neutral' } })
    expect(both(g, at('b', 0.35, tsuHitTick), true)).toEqual({ cancelled: ['a'], grapple: null })
    expect(both(g, at('b', 0.35, pushImpact), true)).toEqual({ cancelled: ['a'], grapple: null })
    for (const a of [pushCharge, pushStartup, pushRecovery]) {
      expect(both(g, at('b', 0.35, a), true)).toEqual({ cancelled: [], grapple: null }) // non-grabbable, no cancel
    }
    expect(both(g, at('b', 0.35, { kind: 'grip', phase: 'recovery', ticksRemaining: 5, direction: { x: -1, y: 0 } }), true)).toEqual({ cancelled: [], grapple: null })
    for (const phase of ['startup', 'recovery'] as const) {
      expect(both(g, at('b', 0.35, { ...tsuHitTick, phase, ticksRemaining: 3, strike: phase === 'startup' ? 'pending' : 'hit' }), true)).toEqual({ cancelled: [], grapple: null })
    }
    // not yet eligible / no contact
    expect(both(at('a', -0.35, reach(3)), at('b', 0.35, { kind: 'idle' }), true)).toEqual({ cancelled: [], grapple: null })
    expect(both(g, at('b', 0.35, { kind: 'idle' }), false)).toEqual({ cancelled: [], grapple: null })
    // a Tsuppari hit reaches without contact; a Push impact needs contact
    expect(both(at('a', -0.4, reach(1)), at('b', 0.4, tsuHitTick), false)).toEqual({ cancelled: ['a'], grapple: null })
    expect(both(at('a', -0.4, reach(1)), at('b', 0.4, pushImpact), false)).toEqual({ cancelled: [], grapple: null })
  })
})

describe('Timing sweeps with role / id / array-order swaps (ACTION-11C)', () => {
  const sweep = (other: Input, gaps: number[], ds: number[], base: number) => {
    let cells = 0
    for (const gap of gaps) {
      for (const d of ds) {
        const r = contest({ gap, base, d, other })
        expectContestInvariants(r, `gap ${gap} d ${d}`)
        cells++
      }
    }
    return cells
  }
  const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  it('Grip / Counter', () => {
    expect(sweep({ counter: true }, [0.7, 0.75, 0.8], range(-14, 7), 20)).toBe(66)
    // window overlapping the success -> neutral; timed out before -> Morozashi
    expect(contest({ gap: 0.7, base: 20, d: -6, other: { counter: true } }).events).toBe('4:grapple neutral')
    expect(contest({ gap: 0.7, base: 20, d: -8, other: { counter: true } }).events).toBe('3:O kuzushi, 4:O stable, 4:grapple morozashi G')
    expect(contest({ gap: 0.8, base: 20, d: 7, other: { counter: true } }).events).toBe('7:grapple neutral')
  })

  it('Grip / Tsuppari', () => {
    expect(sweep({ left: true }, [0.7, 0.75, 0.8, 0.85], range(-17, 8), 20)).toBe(104)
    for (const gap of [0.7, 0.75, 0.8, 0.85]) {
      for (const d of range(-6, 1)) {
        expect(contest({ gap, base: 20, d, other: { left: true } }).events).toBe(`${d + 6}:G cancel, ${d + 6}:O tsu-hit`)
      }
    }
    // pressed before the Grip lands but hitting after the reach: the Grip whiffs, then the hit lands
    expect(contest({ gap: 0.75, base: 20, d: 3, other: { left: true } }).events).toBe('7:G whiff, 9:O tsu-hit')
    // the Grip lands first: the Tsuppari never starts
    expect(contest({ gap: 0.75, base: 20, d: 6, other: { left: true } }).events).toBe('5:grapple neutral')
  })

  it('Grip / Push', () => {
    expect(sweep({ push: true }, [0.7, 0.75, 0.8, 1.2, 1.6], range(-30, 8), 40)).toBe(195)
    expect(contest({ gap: 1.2, base: 40, d: -24, other: { push: true } }).events.startsWith('0:G cancel, 0:O impact')).toBe(true)
    expect(contest({ gap: 0.75, base: 40, d: 6, other: { push: true } }).events).toBe('5:grapple neutral')
  })

  it('Grip / Grip', () => {
    expect(sweep({ grip: true }, [0.7, 0.75, 0.8, 0.9], range(-9, 9), 20)).toBe(76)
    expect(contest({ gap: 0.75, base: 20, d: 0, other: { grip: true } }).events).toBe('4:grapple neutral')
    expect(contest({ gap: 0.9, base: 20, d: 0, other: { grip: true } }).events).toBe('7:grapple neutral')
    expect(contest({ gap: 0.9, base: 20, d: 2, other: { grip: true } }).events).toBe('7:G whiff, 9:O whiff')
  })
})

describe('Existing pairs keep their accepted results (ACTION-11C regression)', () => {
  const pair = (gap: number, a: Input, b: Input, n = 90) => {
    const sim = gapSim(gap)
    sim.step(intents(a, b))
    const snaps = [sim.getSnapshot()]
    for (let t = 1; t < n && sim.getSnapshot().counterTransition.kind === 'none'; t++) {
      sim.step(IDLE)
      snaps.push(sim.getSnapshot())
    }
    return snaps
  }

  it('R1: Push / Push cancel while both impact windows are open', () => {
    const s = pair(COMBINED, { push: true }, { push: true })
    const both = s.filter((x) => [A(x), B(x)].every((p) => p.action.kind === 'push' && (p.action.impactTicksRemaining ?? 0) > 0))
    expect(both.length).toBe(PUSH_IMPACT_TICKS - 1)
    for (const x of both) expect(A(x).externalVelocity).toEqual({ x: 0, y: 0 })
  })

  it('R2: Push / Tsuppari keeps the coupled result (pair shove 0.5325 -> 0.2914 m, buildup +1)', () => {
    const pushOnly = pair(COMBINED, { push: true }, {}).at(-1)!
    const coupled = pair(COMBINED, { push: true }, { left: true }).at(-1)!
    expect(B(pushOnly).position.x - COMBINED / 2).toBeCloseTo(0.5325, 4)
    expect(B(coupled).position.x - COMBINED / 2).toBeCloseTo(0.2914, 4)
    expect(B(coupled).tsuppariBuildup).toBe(1)
  })

  it('R3: Push / Counter: Best catch, transition, pusher Kuzushi', () => {
    const last = pair(COMBINED, { counter: true }, { push: true }).at(-1)!
    expect(last.counterTransition).toMatchObject({ kind: 'active', tier: 'best', pusherId: 'b' })
    expect(B(last).posture.kind).toBe('kuzushi')
  })

  it('R4 / R5 / R6: Tsuppari / Tsuppari both hit; Counter catches Tsuppari; Counter / Counter both fail', () => {
    const tt = pair(COMBINED, { left: true }, { left: true })[TSUPPARI_STARTUP_TICKS]
    expect([A(tt).action, B(tt).action]).toMatchObject([{ strike: 'hit' }, { strike: 'hit' }])
    expect(A(tt).externalVelocity.x).toBeCloseTo(-B(tt).externalVelocity.x, 12)
    const tc = pair(COMBINED, { counter: true }, { left: true })[TSUPPARI_STARTUP_TICKS]
    expect(B(tc).posture.kind).toBe('kuzushi')
    expect(A(tc).externalVelocity).toEqual({ x: 0, y: 0 })
    expect(tc.counterTransition.kind).toBe('none')
    const cc = pair(COMBINED, { counter: true }, { counter: true })[COUNTER_WINDOW_TICKS - 1]
    expect([A(cc).posture.kind, B(cc).posture.kind]).toEqual(['kuzushi', 'kuzushi'])
  })

  it('R7: same-participant priority Push > Tsuppari > Counter > Grip', () => {
    const first = (i: Input) => {
      const sim = gapSim(2)
      sim.step(intents(i))
      return A(sim.getSnapshot()).action.kind
    }
    expect(first({ push: true, left: true, counter: true, grip: true })).toBe('push')
    expect(first({ left: true, counter: true, grip: true })).toBe('tsuppari')
    expect(first({ counter: true, grip: true })).toBe('counter')
    expect(first({ grip: true })).toBe('grip')
  })
})

describe('Ring-out / movement safety (ACTION-11C)', () => {
  it('a whiffed lunge toward an opponent inside the ring never carries the gripper out (Tokudawara ring)', () => {
    let runs = 0
    for (const r0 of [2.2, 2.26, 2.274]) {
      for (let deg = -80; deg <= 80; deg += 10) {
        const ang = Math.PI + (deg * Math.PI) / 180
        for (const d of [0.7, 0.8, 0.9]) {
          const bx = r0 + d * Math.cos(ang)
          const by = d * Math.sin(ang)
          if (Math.hypot(bx, by) > RING.radius - 1e-6) continue
          for (const side of [-1, 0, 1]) {
            const sim = makeSim(r0, bx, { by, arena: RING })
            const away: [number, number] = [-Math.sin(ang) * side, Math.cos(ang) * side]
            for (let t = 0; t < 30 && sim.getSnapshot().outcome.kind === 'ongoing'; t++) {
              sim.step(intents({ grip: t === 0 }, { move: side !== 0 && t < 20 ? away : [0, 0] }))
            }
            const out = sim.getSnapshot().outcome
            expect(out.kind === 'win' && out.loserId === 'a').toBe(false)
            if (out.kind === 'win') expect(out.reason).toBe('ring-out')
            runs++
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(300)
  })
})
