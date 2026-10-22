import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER,
  KUZUSHI_TICKS,
  MAX_EXTERNAL_SPEED,
  PUSH_CHARGE_TICKS,
  PUSH_IMPACT_TICKS,
  PUSH_EXTERNAL_ACCELERATION,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  SIMULATION_HZ,
  TICK_SECONDS,
  TSUPPARI_IMPULSE,
  TSUPPARI_KUZUSHI_BUILDUP,
  TSUPPARI_STARTUP_TICKS,
} from './BoutSimulation.ts'
import type { BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'

// Kuzushi follow-up window (ACTION-09B). Numbered cases follow the Task's required boundary list (D / P / T / G / C).

const R = BODY_RADIUS
const J = TSUPPARI_IMPULSE
const M = KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER
// ACTION-11C: beyond what the ~0.10 m Grip lunge can close against a stationary target (~0.80 m)
const BEYOND_LUNGE = 2 * R + 0.11

interface Input {
  move?: [number, number]
  push?: boolean
  left?: boolean
  right?: boolean
  counter?: boolean
  grip?: boolean
}
const one = (i: Input): ParticipantIntent => ({
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
const sim = (ax: number, bx: number, swap = false) => {
  const a = { id: 'a', position: { x: ax, y: 0 } }
  const b = { id: 'b', position: { x: bx, y: 0 } }
  return new BoutSimulation({ arena: { radius: 100 }, participants: swap ? [b, a] : [a, b] })
}
const stepN = (s: BoutSimulation, n: number, i = IDLE) => {
  for (let k = 0; k < n; k++) s.step(i)
}
const A = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'a') as ParticipantState
const B = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'b') as ParticipantState
const posture = (p: ParticipantState) => (p.posture.kind === 'kuzushi' ? p.posture.ticksRemaining : 'stable')
const gap = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const ready = (p: ParticipantState) => p.action.kind === 'idle' && p.posture.kind === 'stable'
const still = (p: ParticipantState) => Math.hypot(p.velocity.x, p.velocity.y) === 0 && Math.hypot(p.externalVelocity.x, p.externalVelocity.y) === 0

// B fails a Counter pressed on the next tick: after COUNTER_WINDOW_TICKS steps B is in a full Kuzushi.
function failCounterB(s: BoutSimulation): void {
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) s.step(intents({}, { counter: t === 0 }))
}

// A presses one Tsuppari edge and runs to its hit tick; returns the Snapshot of that tick.
function tsuppariHit(s: BoutSimulation, hand: 'left' | 'right' = 'left'): BoutSnapshot {
  s.step(intents({ [hand]: true }))
  stepN(s, TSUPPARI_STARTUP_TICKS)
  return s.getSnapshot()
}

// B walks back into reach and both settle; then A strikes with a ready hand. Returns the hit-tick Snapshot.
function landHitA(s: BoutSimulation): BoutSnapshot {
  for (let t = 0; t < 3000; t++) {
    const snap = s.getSnapshot()
    const a = A(snap)
    const b = B(snap)
    if (ready(a) && ready(b) && gap(snap) <= 0.8 && still(a) && still(b) && (a.tsuppariCooldown.left === 0 || a.tsuppariCooldown.right === 0)) {
      return tsuppariHit(s, a.tsuppariCooldown.left === 0 ? 'left' : 'right')
    }
    s.step(intents({}, gap(snap) > 0.75 && ready(b) ? { move: [-1, 0] } : {}))
  }
  throw new Error('no hit')
}

describe('Kuzushi follow-up window (ACTION-09B)', () => {
  describe('constants', () => {
    it('KUZUSHI_TICKS = 90 (1.5 s at 60 Hz); the follow-up multiplier is 1.5', () => {
      expect(KUZUSHI_TICKS).toBe(90)
      expect(KUZUSHI_TICKS / SIMULATION_HZ).toBe(1.5)
      expect(M).toBe(1.5)
      expect(J * M).toBeCloseTo(3.195, 12)
    })
  })

  describe('duration', () => {
    it('D1 / C1: a Counter Fail enters a full 90-tick Kuzushi', () => {
      const s = sim(-2, 2)
      failCounterB(s)
      expect(B(s.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(s.getSnapshot()).action).toEqual({ kind: 'idle' })
    })

    it('D2 / D3: untouched it lasts 90 full ticks, and the next tick is stable before input (a press starts)', () => {
      const s = sim(-2, 2)
      failCounterB(s)
      for (let k = 1; k <= KUZUSHI_TICKS; k++) {
        s.step(intents({}, { counter: true })) // presses during Kuzushi are ignored
        expect(posture(B(s.getSnapshot()))).toBe(KUZUSHI_TICKS - k)
        expect(B(s.getSnapshot()).action.kind).toBe('idle')
      }
      s.step(intents({}, { counter: true }))
      expect(B(s.getSnapshot()).posture.kind).toBe('stable')
      expect(B(s.getSnapshot()).action.kind).toBe('counter')
    })
  })

  describe('Push follow-up', () => {
    // B fails a Counter in contact; A then pushes. Returns the Snapshot of each tick after A's press.
    function pushOnKuzushi(kuzushi: boolean, swap = false) {
      const s = sim(-R, R, swap)
      if (kuzushi) failCounterB(s)
      else stepN(s, COUNTER_WINDOW_TICKS)
      const snaps: BoutSnapshot[] = []
      s.step(intents({ push: true }))
      snaps.push(s.getSnapshot())
      for (let t = 0; t < PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS + PUSH_RECOVERY_TICKS; t++) {
        s.step(IDLE)
        snaps.push(s.getSnapshot())
      }
      return snaps
    }
    const firstActive = PUSH_STARTUP_TICKS // index in snaps of the first active (force) tick

    it('P3: Push startup does not consume', () => {
      const snaps = pushOnKuzushi(true)
      // snaps[0 .. firstActive - 1]: the startup ticks (the last one already reports the next phase, active)
      for (let i = 0; i < firstActive; i++) {
        expect(A(snaps[i]).action.kind).toBe('push')
        expect(B(snaps[i]).posture.kind).toBe('kuzushi')
        expect(B(snaps[i]).externalVelocity).toEqual({ x: 0, y: 0 })
      }
    })

    it('P1: the first active Push force tick in contact uses 1.5x, then the Kuzushi is consumed', () => {
      const k = pushOnKuzushi(true)[firstActive]
      const n = pushOnKuzushi(false)[firstActive]
      expect(B(n).externalVelocity.x).toBeCloseTo(PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS, 12)
      expect(B(k).externalVelocity.x).toBeCloseTo(PUSH_EXTERNAL_ACCELERATION * M * TICK_SECONDS, 12)
      expect(A(k).externalVelocity).toEqual(B(k).externalVelocity) // pair coupling unchanged
      expect(B(k).posture).toEqual({ kind: 'stable' })
      expect(B(k).action).toEqual({ kind: 'idle' })
    })

    it('P2: the next active Push force tick is the ordinary 1.0x', () => {
      const k = pushOnKuzushi(true)
      const n = pushOnKuzushi(false)
      const dk = B(k[firstActive + 1]).externalVelocity.x - B(k[firstActive]).externalVelocity.x
      const dn = B(n[firstActive + 1]).externalVelocity.x - B(n[firstActive]).externalVelocity.x
      expect(A(k[firstActive + 1]).action).toMatchObject({ kind: 'push', phase: 'active' })
      expect(dk).toBeCloseTo(dn, 12)
      expect(B(k[firstActive + 1]).posture.kind).toBe('stable')
    })

    it('P4 / P5: an active Push without contact and its recovery do not consume', () => {
      const s = sim(-2, 2)
      failCounterB(s)
      s.step(intents({ push: true }))
      const phases = new Set<string>()
      for (let t = 0; t < PUSH_STARTUP_TICKS + PUSH_CHARGE_TICKS + PUSH_RECOVERY_TICKS - 1; t++) {
        s.step(IDLE)
        const snap = s.getSnapshot()
        const action = A(snap).action
        if (action.kind === 'push') phases.add(action.phase)
        expect(B(snap).posture.kind).toBe('kuzushi')
        expect(B(snap).externalVelocity).toEqual({ x: 0, y: 0 })
      }
      expect([...phases].sort()).toEqual(['active', 'recovery', 'startup'])
      expect(posture(B(s.getSnapshot()))).toBe(KUZUSHI_TICKS - (PUSH_STARTUP_TICKS + PUSH_CHARGE_TICKS + PUSH_RECOVERY_TICKS))
    })

    it('P6: a Kuzushi participant can never be one of two cancelling Pushes (its Push press is ignored); equal Pushes still cancel', () => {
      const s = sim(-R, R)
      failCounterB(s)
      s.step(intents({ push: true }, { push: true }))
      expect(B(s.getSnapshot()).action.kind).toBe('idle') // Kuzushi => idle: no Push, so no "cancelled" Push on it
      expect(A(s.getSnapshot()).action.kind).toBe('push')
      const eq = sim(-R, R)
      eq.step(intents({ push: true }, { push: true }))
      stepN(eq, PUSH_STARTUP_TICKS)
      expect(A(eq.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(B(eq.getSnapshot()).externalVelocity).toEqual({ x: 0, y: 0 })
    })

    it('order independence: swapping the participant array gives the same Push follow-up', () => {
      const k = pushOnKuzushi(true)
      const swapped = pushOnKuzushi(true, true)
      for (let i = 0; i < k.length; i++) {
        expect(B(swapped[i])).toEqual(B(k[i]))
        expect(A(swapped[i])).toEqual(A(k[i]))
      }
    })
  })

  describe('Tsuppari follow-up', () => {
    it('T1: a hit on a Kuzushi receiver gives 1.5x the impulse (external-speed clamp applies) and consumes it', () => {
      const k = sim(-0.4, 0.4)
      failCounterB(k)
      const hit = tsuppariHit(k)
      const n = tsuppariHit(sim(-0.4, 0.4))
      expect(A(hit).action).toMatchObject({ kind: 'tsuppari', strike: 'hit' })
      expect(B(n).externalVelocity.x).toBeCloseTo(J, 12)
      expect(B(hit).externalVelocity.x).toBeCloseTo(Math.min(J * M, MAX_EXTERNAL_SPEED), 12)
      expect(B(hit).externalVelocity.x).toBeGreaterThan(B(n).externalVelocity.x)
      expect(B(hit).posture).toEqual({ kind: 'stable' })
      expect(A(hit).tsuppariBuildup).toBe(1)
    })

    it('T2: the following ordinary hit on the now-stable receiver is 1.0x', () => {
      const s = sim(-0.4, 0.4)
      failCounterB(s)
      tsuppariHit(s)
      const second = landHitA(s)
      expect(B(second).posture.kind).toBe('stable')
      expect(B(second).externalVelocity.x).toBeCloseTo(J, 12)
    })

    it('T3: a whiff does not consume', () => {
      const s = sim(-0.5, 0.5)
      failCounterB(s)
      const whiff = tsuppariHit(s)
      expect(A(whiff).action).toMatchObject({ kind: 'tsuppari', strike: 'whiff' })
      expect(B(whiff).posture.kind).toBe('kuzushi')
      expect(B(whiff).externalVelocity).toEqual({ x: 0, y: 0 })
    })

    it('T4: a stable receiver\'s 6th hit is the ordinary impulse and creates a fresh full Kuzushi', () => {
      const s = sim(-R, R)
      for (let n = 0; n < TSUPPARI_KUZUSHI_BUILDUP; n++) landHitA(s)
      const sixth = landHitA(s)
      expect(B(sixth).externalVelocity.x).toBeCloseTo(J, 12)
      expect(B(sixth).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(A(sixth).tsuppariBuildup).toBe(0)
    })

    it('T5: a 6th hit on an already-Kuzushi receiver gets 1.5x, consumes the old Kuzushi, then creates a fresh full one', () => {
      const s = sim(-R, R)
      for (let n = 0; n < TSUPPARI_KUZUSHI_BUILDUP; n++) landHitA(s)
      expect(A(s.getSnapshot()).tsuppariBuildup).toBe(TSUPPARI_KUZUSHI_BUILDUP)
      // settle in reach with a ready hand, then B fails a Counter (A does not strike during the window)
      for (let t = 0; t < 3000; t++) {
        const snap = s.getSnapshot()
        if (ready(A(snap)) && ready(B(snap)) && gap(snap) <= 0.8 && still(A(snap)) && still(B(snap)) && A(snap).tsuppariCooldown.left === 0) break
        s.step(intents({}, gap(snap) > 0.75 && ready(B(snap)) ? { move: [-1, 0] } : {}))
      }
      failCounterB(s)
      const before = s.getSnapshot()
      expect(B(before).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      const hit = tsuppariHit(s)
      expect(A(hit).action).toMatchObject({ kind: 'tsuppari', strike: 'hit' })
      expect(B(hit).externalVelocity.x).toBeCloseTo(Math.min(J * M, MAX_EXTERNAL_SPEED), 12)
      expect(B(hit).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS }) // fresh, not the old remainder
      expect(A(hit).tsuppariBuildup).toBe(0)
    })

    it('T6 / C2: a Counter-caught Tsuppari is unchanged: attacker Kuzushi in place for the full 90 ticks, no impulse', () => {
      const s = sim(0, 0.89)
      s.step(intents({ left: true }, { counter: true }))
      stepN(s, TSUPPARI_STARTUP_TICKS)
      const snap = s.getSnapshot()
      expect(A(snap).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(snap).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(snap.counterTransition.kind).toBe('none')
    })

    it('order independence: swapping the participant array gives the same Tsuppari follow-up', () => {
      const run = (swap: boolean) => {
        const s = sim(-0.4, 0.4, swap)
        failCounterB(s)
        return tsuppariHit(s)
      }
      expect(B(run(true))).toEqual(B(run(false)))
      expect(A(run(true))).toEqual(A(run(false)))
    })
  })

  describe('Grip follow-up', () => {
    it('G1: a valid Grip in contact consumes the Kuzushi and gives the gripper Morozashi', () => {
      const s = sim(-R, R)
      failCounterB(s)
      s.step(intents({ grip: true }))
      for (let k = 1; k < GRIP_MIN_ATTEMPT_TICKS; k++) s.step(IDLE)
      expect(B(s.getSnapshot()).posture.kind).toBe('kuzushi') // the lunge / contact alone consumes nothing
      s.step(IDLE)
      const snap = s.getSnapshot()
      expect(snap.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
      expect(B(snap).posture).toEqual({ kind: 'stable' })
    })

    it('G2 / G3 / G4: a Grip that cannot reach whiffs through its reach and recovery; the Kuzushi is not consumed or bypassed', () => {
      const s = sim(-BEYOND_LUNGE / 2, BEYOND_LUNGE / 2)
      failCounterB(s)
      s.step(intents({ grip: true }))
      for (let t = 0; t < GRIP_REACH_TICKS + 2; t++) {
        const snap = s.getSnapshot()
        expect(snap.engagement.kind).toBe('free')
        expect(B(snap).posture.kind).toBe('kuzushi')
        s.step(IDLE)
      }
      expect(A(s.getSnapshot()).action).toMatchObject({ kind: 'grip', phase: 'recovery' })
      expect(B(s.getSnapshot()).posture.kind).toBe('kuzushi')
    })
  })

  describe('Counter / transition', () => {
    // B pushes into A's Counter (Best) in contact: the transition starts with B (pusher) in Kuzushi.
    function caught(): BoutSimulation {
      const s = sim(-R, R)
      s.step(intents({ counter: true }, { push: true }))
      stepN(s, PUSH_STARTUP_TICKS)
      return s
    }

    it('C3 / C4 / C5: the Counter catch starts the transition, the pusher Kuzushi is paused, then a fresh 90 starts', () => {
      const s = caught()
      expect(s.getSnapshot().counterTransition).toMatchObject({ kind: 'active', pusherId: 'b', counterUserId: 'a' })
      let ticks = 0
      while (s.getSnapshot().counterTransition.kind === 'active') {
        expect(B(s.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
        s.step(intents({ push: true, grip: true, left: true }, { counter: true })) // input lock: nothing resolves
        ticks++
      }
      expect(ticks).toBeLessThanOrEqual(COUNTER_TRANSITION_TICKS)
      expect(B(s.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      s.step(IDLE)
      expect(B(s.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS - 1 })
    })

    function afterTransition(): BoutSimulation {
      const s = caught()
      while (s.getSnapshot().counterTransition.kind === 'active') s.step(IDLE)
      return s
    }

    it('C6a: the first post-transition Grip consumes the Kuzushi (Morozashi)', () => {
      const s = afterTransition()
      s.step(intents({ grip: true }))
      stepN(s, GRIP_MIN_ATTEMPT_TICKS)
      const snap = s.getSnapshot()
      expect(snap.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
      expect(B(snap).posture.kind).toBe('stable')
    })

    it('C6b: the first post-transition Push force gets 1.5x and consumes the Kuzushi', () => {
      const s = afterTransition()
      s.step(intents({ push: true }))
      for (let t = 0; t < PUSH_STARTUP_TICKS - 1; t++) {
        s.step(IDLE)
        expect(B(s.getSnapshot()).posture.kind).toBe('kuzushi')
      }
      const before = B(s.getSnapshot()).externalVelocity
      s.step(IDLE)
      const after = B(s.getSnapshot())
      expect(Math.hypot(after.externalVelocity.x - before.x, after.externalVelocity.y - before.y)).toBeCloseTo(
        PUSH_EXTERNAL_ACCELERATION * M * TICK_SECONDS,
        9,
      )
      expect(after.posture.kind).toBe('stable')
    })

    it('C6c: the first post-transition Tsuppari hit gets 1.5x and consumes the Kuzushi', () => {
      const s = afterTransition()
      const hit = tsuppariHit(s)
      expect(A(hit).action).toMatchObject({ kind: 'tsuppari', strike: 'hit' })
      const v = B(hit).externalVelocity
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(Math.min(J * M, MAX_EXTERNAL_SPEED), 9)
      expect(B(hit).posture.kind).toBe('stable')
    })
  })
})
