import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  KUZUSHI_TICKS,
  PUSH_STARTUP_TICKS,
} from './BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from './BoutTypes.ts'

const COMBINED = 2 * BODY_RADIUS

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
    tsuppariLeftPressed: false,
    tsuppariRightPressed: false,
    counterPressed: i.counter ?? false,
    gripPressed: i.grip ?? false,
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
const kindOf = (s: BoutSnapshot, which: 0 | 1) => {
  const action = s.participants[which].action
  return action.kind === 'grip' ? `grip-${action.phase}` : action.kind
}

function expectFinite(s: BoutSnapshot): void {
  for (const p of s.participants) {
    for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.externalVelocity.x, p.externalVelocity.y, p.facing]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  }
}

const touching = () => new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0))

// `who` fails a Counter on tick 0 and is in Kuzushi for ticks WINDOW..WINDOW+KUZUSHI-1.
function withKuzushi(who: 'a' | 'b', sim = touching()): BoutSimulation {
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) {
    sim.step(who === 'a' ? intents({ counter: t === 0 }) : intents({}, { counter: t === 0 }))
  }
  return sim
}

// ACTION-11C: a Grip pressed in contact lands on reach elapsed GRIP_MIN_ATTEMPT_TICKS (the press tick is 0).
function pressGrip(sim: BoutSimulation, a: Input = { grip: true }, b: Input = {}): void {
  sim.step(intents(a, b))
  stepN(sim, GRIP_MIN_ATTEMPT_TICKS)
}

function grappled(): BoutSimulation {
  const sim = touching()
  pressGrip(sim)
  expect(sim.getSnapshot().engagement.kind).toBe('grappled')
  return sim
}

describe('Grip / Engagement foundation (ACTION-05A)', () => {
  it('T92: a new bout is FREE and the engagement snapshot is an isolated copy', () => {
    const sim = touching()
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'free' })
    pressGrip(sim)
    const s = sim.getSnapshot()
    ;(s.engagement as unknown as { kind: string }).kind = 'free'
    ;(s.engagement as unknown as { advantage: { kind: string } }).advantage.kind = 'morozashi'
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
    // no duplicate grapple flags on participants
    expect(Object.keys(A(s)).sort()).toEqual(
      ['action', 'bodyRadius', 'externalVelocity', 'facing', 'id', 'position', 'posture', 'tsuppariBuildup', 'tsuppariCooldown', 'velocity'].sort(),
    )
  })

  it('T93: a valid Grip on a stable idle target in contact makes a neutral grapple after the minimum attempt', () => {
    const sim = touching()
    sim.step(intents({ grip: true }))
    for (let k = 1; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(IDLE)
    expect(sim.getSnapshot().engagement.kind).toBe('free') // ACTION-11C: never on the press tick
    expect(kindOf(sim.getSnapshot(), 0)).toBe('grip-reach')
    sim.step(IDLE)
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
    expect(A(s).action).toEqual({ kind: 'idle' })
    expect(B(s).action).toEqual({ kind: 'idle' })
    expect(dist(s)).toBeCloseTo(COMBINED, 12)
  })

  it('T94: a valid Grip on a Kuzushi target gives Morozashi to the gripper and consumes Kuzushi', () => {
    const sim = withKuzushi('b')
    expect(B(sim.getSnapshot()).posture.kind).toBe('kuzushi')
    pressGrip(sim)
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(B(s).posture).toEqual({ kind: 'stable' })
    expect(A(s).posture).toEqual({ kind: 'stable' })

    const mirrored = withKuzushi('a')
    pressGrip(mirrored, {}, { grip: true })
    const m = mirrored.getSnapshot()
    expect(m.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'b' } })
    expect(A(m).posture).toEqual({ kind: 'stable' })
  })

  it('T95: beyond the lunge the Grip whiffs into Recovery (Kuzushi does not bypass)', () => {
    // ACTION-11C: success needs actual contact; the ~0.10 m lunge reaches a stationary target up to ~0.80 m
    const beyond = new BoutSimulation(setupAt(-COMBINED - 0.11, 0, 0, 0))
    beyond.step(intents({ grip: true }))
    for (let t = 1; t < GRIP_REACH_TICKS; t++) beyond.step(IDLE)
    expect(beyond.getSnapshot().engagement.kind).toBe('free')
    expect(kindOf(beyond.getSnapshot(), 0)).toBe('grip-recovery')
    expect(A(beyond.getSnapshot()).posture.kind).toBe('stable') // no Kuzushi penalty

    const kuzushiFar = withKuzushi('b', new BoutSimulation(setupAt(-COMBINED - 0.11, 0, 0, 0)))
    expect(B(kuzushiFar.getSnapshot()).posture.kind).toBe('kuzushi')
    kuzushiFar.step(intents({ grip: true }))
    stepN(kuzushiFar, GRIP_REACH_TICKS - 1)
    expect(kuzushiFar.getSnapshot().engagement.kind).toBe('free')
    expect(B(kuzushiFar.getSnapshot()).posture.kind).toBe('kuzushi')
  })

  it('T96: one edge = one Grip; presses during the action are ignored; Push > Counter > Grip', () => {
    const far = new BoutSimulation(setupAt(-3, 0, 3, 0))
    const seen: string[] = []
    for (let t = 0; t < GRIP_REACH_TICKS + GRIP_RECOVERY_TICKS; t++) {
      far.step(intents({ grip: true })) // mashing / holding
      seen.push(kindOf(far.getSnapshot(), 0))
    }
    expect(seen.filter((k) => k === 'grip-reach').length).toBe(GRIP_REACH_TICKS - 1)
    expect(seen.at(-1)).toBe('idle') // nothing was queued
    far.step(intents({ grip: true }))
    expect(kindOf(far.getSnapshot(), 0)).toBe('grip-reach')

    const all = touching()
    all.step(intents({ push: true, counter: true, grip: true }))
    expect(kindOf(all.getSnapshot(), 0)).toBe('push')
    expect(all.getSnapshot().engagement.kind).toBe('free')
    const counterGrip = touching()
    counterGrip.step(intents({ counter: true, grip: true }))
    expect(kindOf(counterGrip.getSnapshot(), 0)).toBe('counter')
    expect(counterGrip.getSnapshot().engagement.kind).toBe('free')
  })

  it('T97: Grip never takes a Push or a Grip Recovery; a reach can wait for the target to go idle', () => {
    // Push: B pushes on tick 0; A's eligible reach (ticks 4..5) only meets B's Startup; B's impact (tick 6)
    // then cancels A's reach (ACTION-11C Push > Grip, see BoutGripContest.test.ts)
    const vsPush = touching()
    vsPush.step(intents({ grip: true }, { push: true }))
    stepN(vsPush, GRIP_REACH_TICKS - 1)
    expect(vsPush.getSnapshot().engagement.kind).toBe('free')
    expect(kindOf(vsPush.getSnapshot(), 1)).toBe('push')

    // Grip Recovery: B releases a grapple (Grip Recovery, still in contact); A's whole reach meets that recovery
    const vsGrip = grappled()
    vsGrip.step(intents({}, { grip: true }))
    expect(kindOf(vsGrip.getSnapshot(), 1)).toBe('grip-recovery')
    vsGrip.step(intents({ grip: true }))
    stepN(vsGrip, GRIP_REACH_TICKS - 1)
    expect(dist(vsGrip.getSnapshot())).toBeCloseTo(COMBINED, 9)
    expect(vsGrip.getSnapshot().engagement.kind).toBe('free')
    expect(kindOf(vsGrip.getSnapshot(), 1)).toBe('grip-recovery')

    // Waiting: B's Push ends on tick 23; A's reach on ticks 20..27 is eligible from tick 24 and grips there
    const wait = touching()
    let grippedAt = -1
    for (let t = 0; t < 30 && grippedAt < 0; t++) {
      wait.step(intents({ grip: t === 20 }, { push: t === 0 }))
      if (wait.getSnapshot().engagement.kind === 'grappled') grippedAt = t
    }
    expect(grippedAt).toBe(24)
  })

  it('T98: the Kuzushi state on the resolving tick decides (ticksRemaining 0 recovers first)', () => {
    // the Grip resolves GRIP_MIN_ATTEMPT_TICKS after the press
    const last = withKuzushi('b')
    stepN(last, KUZUSHI_TICKS - 1 - GRIP_MIN_ATTEMPT_TICKS)
    last.step(intents({ grip: true }))
    stepN(last, GRIP_MIN_ATTEMPT_TICKS - 1)
    expect(B(last.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: 1 })
    expect(last.getSnapshot().engagement.kind).toBe('free') // the lunge in contact consumes nothing
    last.step(IDLE) // last full Kuzushi tick
    expect(last.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })

    const zero = withKuzushi('b')
    stepN(zero, KUZUSHI_TICKS - GRIP_MIN_ATTEMPT_TICKS)
    zero.step(intents({ grip: true }))
    stepN(zero, GRIP_MIN_ATTEMPT_TICKS - 1)
    expect(B(zero.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: 0 })
    zero.step(IDLE) // B recovers at the start of this tick
    expect(zero.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  })

  it('T99: simultaneous stable Grips in contact make a symmetric neutral grapple', () => {
    const sim = touching()
    pressGrip(sim, { grip: true }, { grip: true })
    expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
    // participant order does not matter
    const swapped = new BoutSimulation({
      arena: { radius: 100 },
      participants: [
        { id: 'b', position: { x: COMBINED / 2, y: 0 } },
        { id: 'a', position: { x: -COMBINED / 2, y: 0 } },
      ],
    })
    pressGrip(swapped, { grip: true }, { grip: true })
    expect(swapped.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  })

  it('T100: a Kuzushi participant cannot initiate; both Kuzushi -> nothing', () => {
    const one = withKuzushi('a')
    pressGrip(one, { grip: true }, { grip: true })
    expect(one.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'b' } })

    const both = touching()
    for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) both.step(intents({ counter: t === 0 }, { counter: t === 0 }))
    pressGrip(both, { grip: true }, { grip: true })
    expect(both.getSnapshot().engagement.kind).toBe('free')
    expect(kindOf(both.getSnapshot(), 0)).toBe('idle')
    expect(kindOf(both.getSnapshot(), 1)).toBe('idle')
  })

  // ACTION-04A4: the Counter user regains control only after the Counter transition; the pusher then
  // gets a full Kuzushi, so the Counter -> Grip -> Morozashi opening is kept after the exchange.
  it('T101 / T108: Best Counter -> rear -> (transition) -> Grip gives Morozashi; both at rest', () => {
    const sim = touching()
    for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
    expect(sim.getSnapshot().counterTransition.kind).toBe('active')
    // a Grip edge during the transition is dropped, not queued
    sim.step(intents({ grip: true }))
    stepN(sim, COUNTER_TRANSITION_TICKS - 1)
    const before = sim.getSnapshot()
    expect(before.counterTransition).toEqual({ kind: 'none' })
    expect(before.engagement).toEqual({ kind: 'free' })
    expect(A(before).action).toEqual({ kind: 'idle' })
    expect(B(before).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    expect(A(before).externalVelocity).toEqual({ x: 0, y: 0 })
    expect(B(before).externalVelocity).toEqual({ x: 0, y: 0 })
    pressGrip(sim)
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
    expect(B(s).externalVelocity).toEqual(A(s).externalVelocity)
    expect(dist(s)).toBeCloseTo(COMBINED, 12)
  })

  it('T108: Success Counter -> side -> Grip right after the transition, or late in the renewed Kuzushi, gives Morozashi', () => {
    const success = touching()
    for (let t = 0; t <= PUSH_STARTUP_TICKS + 4; t++) {
      success.step(intents({ counter: t === PUSH_STARTUP_TICKS + 4 }, { push: t === 0 }))
    }
    stepN(success, COUNTER_TRANSITION_TICKS)
    expect(B(success.getSnapshot()).posture.kind).toBe('kuzushi')
    pressGrip(success)
    expect(success.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })

    // the renewed Kuzushi lasts KUZUSHI_TICKS full ticks after completion; one later the target is stable
    const late = (wait: number) => {
      const sim = touching()
      for (let t = 0; t <= PUSH_STARTUP_TICKS + 4; t++) {
        sim.step(intents({ counter: t === PUSH_STARTUP_TICKS + 4 }, { push: t === 0 }))
      }
      stepN(sim, COUNTER_TRANSITION_TICKS + wait - GRIP_MIN_ATTEMPT_TICKS)
      pressGrip(sim)
      return sim.getSnapshot().engagement
    }
    // the Grip lands on tick wait + 1 after completion (pressed GRIP_MIN_ATTEMPT_TICKS earlier): tick
    // KUZUSHI_TICKS is the last Kuzushi tick
    expect(late(KUZUSHI_TICKS - 1)).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(late(KUZUSHI_TICKS)).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  })

  it('T102: the lunge closes a gap and attaches on actual contact: no bond snap, the target never moved', () => {
    const gap = 0.08
    const sim = new BoutSimulation(setupAt(-COMBINED / 2 - gap / 2, 0.3, COMBINED / 2 + gap / 2, 0.3))
    sim.step(intents({ grip: true }))
    let t = 0
    while (sim.getSnapshot().engagement.kind === 'free' && t < GRIP_REACH_TICKS) {
      sim.step(IDLE)
      t++
    }
    const s = sim.getSnapshot()
    expect(s.engagement.kind).toBe('grappled')
    expect(dist(s)).toBeCloseTo(COMBINED, 12)
    expect(B(s).position.x).toBeCloseTo(COMBINED / 2 + gap / 2, 12) // contact never displaced the target
    expect(A(s).position.x).toBeCloseTo(COMBINED / 2 + gap / 2 - COMBINED, 9) // the gripper lunged into contact
    expect(A(s).position.y).toBeCloseTo(0.3, 12)
  })

  // ACTION-12B: a READY pair now rotates on tangential WASD (BoutGrappleRotation.test.ts); radial WASD (pulling
  // straight apart along the pair axis) must still hold the pair exactly in place.
  it('T103: the bond holds the exact distance under opposing radial WASD; no drift or jitter', () => {
    const sim = grappled()
    const p0 = sim.getSnapshot()
    for (let k = 0; k < 180; k++) {
      sim.step(intents({ move: [-1, 0] }, { move: [1, 0] }))
      const s = sim.getSnapshot()
      expectFinite(s)
      expect(dist(s)).toBeCloseTo(COMBINED, 12)
      expect(A(s).position).toEqual(A(p0).position)
      expect(B(s).position).toEqual(B(p0).position)
      expect(A(s).velocity).toEqual({ x: 0, y: 0 })
    }
  })

  it('T104: while grappled, Push / Counter edges and WASD do nothing', () => {
    const sim = grappled()
    for (let k = 0; k < 40; k++) {
      sim.step(intents({ push: true, move: [1, 0] }, { counter: true, push: k % 2 === 0, move: [0, 1] }))
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('grappled')
      expect(kindOf(s, 0)).toBe('idle')
      expect(kindOf(s, 1)).toBe('idle')
      expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
    }
  })

  it('T105: one-sided release (neutral and Morozashi): releaser recovers, no same-tick FREE action', () => {
    const neutral = grappled()
    neutral.step(intents({ grip: true }, { push: true, counter: true }))
    let s = neutral.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(A(s).action).toMatchObject({ kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS - 1 })
    expect(kindOf(s, 1)).toBe('idle') // B's same-tick Push / Counter dropped, not queued
    neutral.step(IDLE)
    expect(kindOf(neutral.getSnapshot(), 1)).toBe('idle')
    neutral.step(intents({ move: [1, 0] }, { move: [1, 0] })) // B steers freely, A cannot
    s = neutral.getSnapshot()
    expect(B(s).velocity.x).toBeGreaterThan(0)
    expect(A(s).velocity).toEqual({ x: 0, y: 0 })

    const moro = withKuzushi('b')
    pressGrip(moro)
    moro.step(intents({}, { grip: true })) // the disadvantaged side releases
    s = moro.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    expect(kindOf(s, 1)).toBe('grip-recovery')
    expect(kindOf(s, 0)).toBe('idle')
  })

  it('T106: simultaneous release is symmetric', () => {
    const sim = grappled()
    sim.step(intents({ grip: true }, { grip: true }))
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'free' })
    // identical phase / timer; each recovery carries its own facing at release as direction (unused while recovering)
    const { direction: _da, ...actionA } = A(s).action as Extract<BoutSnapshot['participants'][number]['action'], { kind: 'grip' }>
    const { direction: _db, ...actionB } = B(s).action as Extract<BoutSnapshot['participants'][number]['action'], { kind: 'grip' }>
    expect(actionA).toEqual(actionB)
    expect(kindOf(s, 0)).toBe('grip-recovery')
  })

  it('T107: release keeps position / velocity / facing and clears the advantage', () => {
    const sim = withKuzushi('b')
    pressGrip(sim)
    expect(sim.getSnapshot().engagement.kind).toBe('grappled')
    stepN(sim, 30)
    const before = sim.getSnapshot()
    sim.step(intents({ grip: true }))
    const after = sim.getSnapshot()
    expect(after.engagement).toEqual({ kind: 'free' })
    expect(A(after).position).toEqual(A(before).position)
    expect(B(after).position).toEqual(B(before).position)
    expect(A(after).velocity).toEqual(A(before).velocity)
    expect(A(after).facing).toBe(A(before).facing)
    expect(B(after).facing).toBe(B(before).facing)
  })

  it('T109: holder invariant: exactly one holder for Morozashi, none for neutral, cleared on release', () => {
    const moro = withKuzushi('b')
    pressGrip(moro)
    const e = moro.getSnapshot().engagement
    expect(e.kind === 'grappled' && e.advantage.kind === 'morozashi' && e.advantage.holderId).toBe('a')
    const n = grappled().getSnapshot().engagement
    expect(n).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
    expect('holderId' in (n.kind === 'grappled' ? n.advantage : {})).toBe(false)
    moro.step(intents({ grip: true }))
    expect(moro.getSnapshot().engagement).toEqual({ kind: 'free' })
  })

  it('T112: exact Reach / Recovery timing (whiff and release)', () => {
    const sim = new BoutSimulation(setupAt(-3, 0, 3, 0))
    const applied: string[] = []
    sim.step(intents({ grip: true }))
    applied.push('grip-reach')
    for (let k = 1; k < GRIP_REACH_TICKS + GRIP_RECOVERY_TICKS + 3; k++) {
      applied.push(kindOf(sim.getSnapshot(), 0))
      const action = A(sim.getSnapshot()).action
      if (action.kind === 'grip') expect(action.ticksRemaining).toBeGreaterThanOrEqual(1)
      sim.step(IDLE)
    }
    expect(applied.slice(0, GRIP_REACH_TICKS + GRIP_RECOVERY_TICKS + 1)).toEqual([
      ...Array(GRIP_REACH_TICKS).fill('grip-reach'),
      ...Array(GRIP_RECOVERY_TICKS).fill('grip-recovery'),
      'idle',
    ])

    const rel = grappled()
    rel.step(intents({ grip: true }))
    stepN(rel, GRIP_RECOVERY_TICKS - 2)
    expect(kindOf(rel.getSnapshot(), 0)).toBe('grip-recovery')
    rel.step(IDLE)
    expect(kindOf(rel.getSnapshot(), 0)).toBe('idle') // release tick + 11 = 12 recovery ticks
  })

  it('T114: mixed sequences replay identically, stay finite and keep engagement invariants', () => {
    const run = () => {
      const sim = new BoutSimulation(setupAt(-0.5, 0.05, 0.4, -0.05))
      const script: [number, Input, Input][] = [
        [1, { grip: true }, { push: true }],
        [30, { move: [1, 0] }, {}],
        [1, { grip: true }, {}],
        [20, { move: [-1, 0] }, { move: [1, 0] }],
        [1, {}, { grip: true }],
        [10, { move: [-1, 0] }, {}],
        [1, { counter: true }, {}],
        [5, {}, {}],
        [1, {}, { push: true }],
        [20, {}, {}],
        [1, { grip: true }, {}],
        [10, {}, {}],
        [1, { grip: true }, { grip: true }],
        [40, { move: [0, 1] }, { move: [-1, 0] }],
        [1, { grip: true }, { grip: true }],
        [30, { push: true }, { counter: true }],
      ]
      for (const [n, ia, ib] of script) {
        for (let k = 0; k < n; k++) {
          sim.step(intents(ia, ib))
          const s = sim.getSnapshot()
          expectFinite(s)
          expect(dist(s)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
          if (s.engagement.kind === 'grappled') {
            expect(dist(s)).toBeCloseTo(COMBINED, 9)
            expect(A(s).posture.kind).toBe('stable')
            expect(B(s).posture.kind).toBe('stable')
            expect(kindOf(s, 0)).toBe('idle')
            expect(kindOf(s, 1)).toBe('idle')
            if (s.engagement.advantage.kind === 'morozashi') {
              expect(['a', 'b']).toContain(s.engagement.advantage.holderId)
            }
          }
        }
      }
      return sim.getSnapshot()
    }
    expect(run()).toEqual(run())
  })
})
