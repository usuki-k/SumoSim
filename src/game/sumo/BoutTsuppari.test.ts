import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_WINDOW_TICKS,
  EXTERNAL_DECELERATION,
  KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER,
  KUZUSHI_TICKS,
  MAX_EXTERNAL_SPEED,
  PUSH_CHARGE_TICKS,
  PUSH_IMPACT_TICKS,
  PUSH_EXTERNAL_ACCELERATION,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  TICK_SECONDS,
  TSUPPARI_ACTIVE_TICKS,
  TSUPPARI_COUPLED_SHARE,
  TSUPPARI_HAND_COOLDOWN_TICKS,
  TSUPPARI_HAND_REACH,
  TSUPPARI_IMPULSE,
  TSUPPARI_KUZUSHI_BUILDUP,
  TSUPPARI_RECOVERY_TICKS,
  TSUPPARI_STARTUP_TICKS,
} from './BoutSimulation.ts'
import type { ArenaSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'

// Tsuppari (ACTION-07B). Numbered cases TSnn follow the Task's explicit boundary list.

const R = BODY_RADIUS
const REACH = TSUPPARI_HAND_REACH + R // center-distance threshold with equal radii
const TOTAL = TSUPPARI_STARTUP_TICKS + TSUPPARI_ACTIVE_TICKS + TSUPPARI_RECOVERY_TICKS
const J = TSUPPARI_IMPULSE

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

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  return new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
}

const IDLE = intents()

// A on the left, B on the right, on the x axis (so the A -> B axis is exactly +x).
function sim(ax: number, bx: number, arena: ArenaSetup = { radius: 100 }, swap = false): BoutSimulation {
  const a = { id: 'a', position: { x: ax, y: 0 } }
  const b = { id: 'b', position: { x: bx, y: 0 } }
  return new BoutSimulation({ arena, participants: swap ? [b, a] : [a, b] })
}

function stepN(s: BoutSimulation, n: number, i = IDLE): void {
  for (let k = 0; k < n; k++) s.step(i)
}

const A = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'a') as ParticipantState
const B = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'b') as ParticipantState
const gap = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)
const kind = (p: ParticipantState) => p.action.kind
const hand = (p: ParticipantState) => (p.action.kind === 'tsuppari' ? p.action.hand : null)
const strike = (p: ParticipantState) => (p.action.kind === 'tsuppari' ? p.action.strike : null)

// Presses one edge on tick 0 and runs to the hit tick (TSUPPARI_STARTUP_TICKS + 1 steps); returns the
// Snapshots just before and just after the hit tick.
function toHitTick(s: BoutSimulation, a: Input, b: Input = {}): { before: BoutSnapshot; after: BoutSnapshot } {
  s.step(intents(a, b))
  stepN(s, TSUPPARI_STARTUP_TICKS - 1)
  const before = s.getSnapshot()
  s.step(IDLE)
  return { before, after: s.getSnapshot() }
}

const isStill = (p: ParticipantState) => speed(p.externalVelocity) === 0 && speed(p.velocity) === 0
const ready = (p: ParticipantState) => p.action.kind === 'idle' && p.posture.kind === 'stable'

// One landed hit by `atk`: the receiver walks back into range, both settle, then the attacker strikes with
// a ready hand (Left first). Returns the Snapshot right after the hit tick.
function landHit(s: BoutSimulation, atk: 'a' | 'b'): BoutSnapshot {
  const get = (snap: BoutSnapshot, id: string) => (id === 'a' ? A(snap) : B(snap))
  const rec = atk === 'a' ? 'b' : 'a'
  for (let t = 0; t < 2000; t++) {
    const snap = s.getSnapshot()
    const att = get(snap, atk)
    const other = get(snap, rec)
    const towardAttacker = Math.sign(att.position.x - other.position.x)
    const recInput: Input = gap(snap) > 0.75 && ready(other) ? { move: [towardAttacker, 0] } : {}
    let attInput: Input = {}
    if (ready(att) && ready(other) && gap(snap) <= 0.8 && isStill(att) && isStill(other)) {
      if (att.tsuppariCooldown.left === 0) attInput = { left: true }
      else if (att.tsuppariCooldown.right === 0) attInput = { right: true }
    }
    s.step(atk === 'a' ? intents(attInput, recInput) : intents(recInput, attInput))
    const after = s.getSnapshot()
    if (strike(att) === 'pending' && strike(get(after, atk)) === 'hit') return after
  }
  throw new Error('no hit landed')
}

// Both settle within range, then both strike on the same tick; returns Snapshots around the hit tick.
function bothStrike(s: BoutSimulation): { before: BoutSnapshot; after: BoutSnapshot } {
  for (let t = 0; t < 2000; t++) {
    const snap = s.getSnapshot()
    const a = A(snap)
    const b = B(snap)
    if (ready(a) && ready(b) && isStill(a) && isStill(b) && gap(snap) <= 0.8) {
      const pick = (p: ParticipantState): Input | null =>
        p.tsuppariCooldown.left === 0 ? { left: true } : p.tsuppariCooldown.right === 0 ? { right: true } : null
      const ia = pick(a)
      const ib = pick(b)
      if (ia && ib) return toHitTick(s, ia, ib)
      s.step(IDLE) // settled; wait for a ready hand on both sides
      continue
    }
    const close = gap(snap) > 0.75
    s.step(intents(close && ready(a) ? { move: [1, 0] } : {}, close && ready(b) ? { move: [-1, 0] } : {}))
  }
  throw new Error('no simultaneous strike')
}

// Representative fixture F1 (ACTION-07A): touching pair, one action edge on tick 0, receiver displacement
// once all external momentum has decayed.
function receiverDisplacement(input: Input): { receiver: number; attacker: number } {
  const s = sim(-R, R)
  s.step(intents(input))
  stepN(s, 120)
  const after = s.getSnapshot()
  return { receiver: B(after).position.x - R, attacker: A(after).position.x + R }
}

describe('Tsuppari (ACTION-07B)', () => {
  describe('input / cooldown', () => {
    it('TS01: Left with both hands ready starts a left Tsuppari; only that hand goes on cooldown', () => {
      const s = sim(-1, 1)
      s.step(intents({ left: true }))
      const a = A(s.getSnapshot())
      expect(a.action).toEqual({ kind: 'tsuppari', hand: 'left', phase: 'startup', ticksRemaining: TSUPPARI_STARTUP_TICKS - 1, strike: 'pending' })
      expect(a.tsuppariCooldown).toEqual({ left: TSUPPARI_HAND_COOLDOWN_TICKS, right: 0 })
    })

    // Left used at tick 0; at tick 20 the action is over but Left is still cooling down.
    function leftCooling(): BoutSimulation {
      const s = sim(-1, 1)
      s.step(intents({ left: true }))
      stepN(s, 19)
      const a = A(s.getSnapshot())
      expect(a.action.kind).toBe('idle')
      expect(a.tsuppariCooldown).toEqual({ left: TSUPPARI_HAND_COOLDOWN_TICKS - 19, right: 0 })
      return s
    }

    it('TS02: Left on cooldown + Left only: nothing starts, the edge is dropped, cooldowns just count down', () => {
      const s = leftCooling()
      s.step(intents({ left: true }))
      const a = A(s.getSnapshot())
      expect(a.action.kind).toBe('idle')
      expect(a.tsuppariCooldown).toEqual({ left: TSUPPARI_HAND_COOLDOWN_TICKS - 20, right: 0 })
    })

    it('TS03: Left on cooldown + Right: a right Tsuppari starts', () => {
      const s = leftCooling()
      s.step(intents({ right: true }))
      const a = A(s.getSnapshot())
      expect(hand(a)).toBe('right')
      expect(a.tsuppariCooldown).toEqual({ left: TSUPPARI_HAND_COOLDOWN_TICKS - 20, right: TSUPPARI_HAND_COOLDOWN_TICKS })
    })

    it('TS04: Right on cooldown + Right only: nothing starts', () => {
      const s = sim(-1, 1)
      s.step(intents({ right: true }))
      stepN(s, 19)
      s.step(intents({ right: true }))
      const a = A(s.getSnapshot())
      expect(a.action.kind).toBe('idle')
      expect(a.tsuppariCooldown).toEqual({ left: 0, right: TSUPPARI_HAND_COOLDOWN_TICKS - 20 })
    })

    function bothCooling(): BoutSimulation {
      const s = sim(-1, 1)
      s.step(intents({ left: true }))
      stepN(s, TOTAL - 1)
      s.step(intents({ right: true }))
      stepN(s, TOTAL - 1)
      const a = A(s.getSnapshot())
      expect(a.action.kind).toBe('idle')
      expect(a.tsuppariCooldown.left).toBeGreaterThan(0)
      expect(a.tsuppariCooldown.right).toBeGreaterThan(0)
      return s
    }

    it('TS05: both hands on cooldown: no Tsuppari; a lower-priority Counter or Grip edge still starts', () => {
      const none = bothCooling()
      none.step(intents({ left: true, right: true }))
      expect(A(none.getSnapshot()).action.kind).toBe('idle')

      const counter = bothCooling()
      counter.step(intents({ left: true, right: true, counter: true }))
      expect(A(counter.getSnapshot()).action.kind).toBe('counter')

      const grip = bothCooling()
      grip.step(intents({ left: true, right: true, grip: true }))
      expect(A(grip.getSnapshot()).action.kind).toBe('grip')
    })

    it('TS06: Left + Right on one tick with both ready: Left; Right is dropped (stays ready, not queued)', () => {
      const s = sim(-1, 1)
      s.step(intents({ left: true, right: true }))
      const a = A(s.getSnapshot())
      expect(hand(a)).toBe('left')
      expect(a.tsuppariCooldown).toEqual({ left: TSUPPARI_HAND_COOLDOWN_TICKS, right: 0 })
      stepN(s, TOTAL + 5)
      expect(A(s.getSnapshot()).action.kind).toBe('idle') // nothing queued
    })

    it('TS07: Left on cooldown + Right on one tick: Right', () => {
      const s = leftCooling()
      s.step(intents({ left: true, right: true }))
      expect(hand(A(s.getSnapshot()))).toBe('right')
    })

    it('TS08: Push + Left: Push; the Left edge is dropped and its hand stays ready', () => {
      const s = sim(-1, 1)
      s.step(intents({ push: true, left: true }))
      const a = A(s.getSnapshot())
      expect(a.action.kind).toBe('push')
      expect(a.tsuppariCooldown).toEqual({ left: 0, right: 0 })
    })

    it('TS09: Left + Counter: Tsuppari', () => {
      const s = sim(-1, 1)
      s.step(intents({ left: true, counter: true }))
      expect(hand(A(s.getSnapshot()))).toBe('left')
    })

    it('TS10: Left + Grip: Tsuppari', () => {
      const s = sim(-1, 1)
      s.step(intents({ left: true, grip: true }))
      expect(hand(A(s.getSnapshot()))).toBe('left')
    })

    it('TS11: WASD is locked (braking, no own drive) for the whole Tsuppari, then returns', () => {
      const s = sim(-3, 3)
      const walk = intents({ move: [1, 0] })
      stepN(s, 10, walk) // walking toward B at some speed
      const walking = A(s.getSnapshot()).velocity.x
      expect(walking).toBeGreaterThan(0)
      s.step(intents({ move: [1, 0], left: true }))
      let previous = A(s.getSnapshot()).velocity.x
      expect(previous).toBeLessThan(walking) // braking from the accept tick on
      for (let t = 1; t < TOTAL; t++) {
        s.step(walk)
        const a = A(s.getSnapshot())
        // The action is over at the end of its 16th tick (the last tick still brakes).
        expect(a.action.kind).toBe(t < TOTAL - 1 ? 'tsuppari' : 'idle')
        expect(a.velocity.x).toBeLessThanOrEqual(previous) // never driven forward while held
        previous = a.velocity.x
      }
      expect(previous).toBe(0)
      s.step(walk)
      expect(A(s.getSnapshot()).velocity.x).toBeGreaterThan(0) // WASD works again
    })

    it('TS12: a hand accepted at t0 is rejected through t0+59 and accepted again at exactly t0+60', () => {
      const s = sim(-3, 3)
      const accepted: string[] = []
      for (let t = 0; t <= 2 * TSUPPARI_HAND_COOLDOWN_TICKS; t++) {
        const before = A(s.getSnapshot())
        s.step(intents({ left: true }))
        const a = A(s.getSnapshot())
        if (before.action.kind === 'idle' && a.action.kind === 'tsuppari') accepted.push(`${t}:${hand(a)}`)
        // Countdown from the accept tick: cooldown = 60 - ticks since acceptance.
        const sinceAccept = t % TSUPPARI_HAND_COOLDOWN_TICKS
        expect(a.tsuppariCooldown.left).toBe(TSUPPARI_HAND_COOLDOWN_TICKS - sinceAccept)
      }
      expect(accepted).toEqual(['0:left', '60:left', '120:left'])

      // Mashing both: the other hand fills in as soon as the action ends -> 2 per 60 ticks.
      const both = sim(-3, 3)
      const order: string[] = []
      for (let t = 0; t < 140; t++) {
        const before = A(both.getSnapshot())
        both.step(intents({ left: true, right: true }))
        const a = A(both.getSnapshot())
        if (before.action.kind === 'idle' && a.action.kind === 'tsuppari') order.push(`${t}:${hand(a)}`)
      }
      expect(order).toEqual([`0:left`, `${TOTAL}:right`, '60:left', `${60 + TOTAL}:right`, '120:left', `${120 + TOTAL}:right`])
    })

    it('TS13: a new Bout starts with both hands ready and no buildup', () => {
      const s = sim(-R, R)
      landHit(s, 'a')
      const used = A(s.getSnapshot())
      expect(used.tsuppariBuildup).toBe(1)
      expect(used.tsuppariCooldown.left).toBeGreaterThan(0)
      const fresh = sim(-R, R).getSnapshot()
      for (const p of fresh.participants) {
        expect(p.tsuppariCooldown).toEqual({ left: 0, right: 0 })
        expect(p.tsuppariBuildup).toBe(0)
      }
    })
  })

  describe('hit / reach / buildup', () => {
    it('TS14: beyond reach the strike whiffs: no impulse, no buildup', () => {
      const s = sim(-0.5, 0.5)
      const { after } = toHitTick(s, { left: true })
      expect(strike(A(after))).toBe('whiff')
      expect(B(after).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(after).tsuppariBuildup).toBe(0)
    })

    it('TS15: an ordinary hit at body contact gives only the receiver the impulse, exactly on the hit tick', () => {
      const s = sim(-R, R)
      const { before, after } = toHitTick(s, { left: true })
      expect(strike(A(before))).toBe('pending')
      expect(strike(A(after))).toBe('hit')
      expect(A(after).action).toMatchObject({ phase: 'recovery', ticksRemaining: TSUPPARI_RECOVERY_TICKS })
      expect(B(after).externalVelocity).toEqual({ x: J, y: 0 })
      expect(A(after).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(after).position).toEqual({ x: -R, y: 0 })
      expect(A(after).tsuppariBuildup).toBe(1)
      expect(B(after).posture.kind).toBe('stable')
    })

    it('TS16: within reach but not in body contact it still hits', () => {
      const s = sim(-0.425, 0.425) // 0.85 m apart, contact is 0.70 m
      const { after } = toHitTick(s, { right: true })
      expect(strike(A(after))).toBe('hit')
      expect(B(after).externalVelocity).toEqual({ x: J, y: 0 })
    })

    it('TS17: reach boundary: hit just inside, whiff just outside (center distance = 0.55 + receiver radius)', () => {
      expect(TSUPPARI_HAND_REACH).toBe(0.55)
      expect(REACH).toBeCloseTo(0.9, 12)
      const inside = sim(0, REACH - 1e-6)
      expect(strike(A(toHitTick(inside, { left: true }).after))).toBe('hit')
      const outside = sim(0, REACH + 1e-6)
      expect(strike(A(toHitTick(outside, { left: true }).after))).toBe('whiff')
    })

    it('TS17b: the extended band (old 0.875 m .. new 0.90 m) hits with either hand and gives the full impulse', () => {
      for (const d of [0.876, 0.89, 0.899]) {
        for (const h of ['left', 'right'] as const) {
          const { after } = toHitTick(sim(0, d), { [h]: true })
          expect(strike(A(after))).toBe('hit')
          expect(B(after).externalVelocity).toEqual({ x: J, y: 0 })
          expect(A(after).tsuppariBuildup).toBe(1)
        }
      }
      for (const d of [0.901, 0.95]) {
        const { after } = toHitTick(sim(0, d), { right: true })
        expect(strike(A(after))).toBe('whiff')
        expect(B(after).externalVelocity).toEqual({ x: 0, y: 0 })
      }
    })

    it('TS18 / TS19: hits 1..5 are ordinary; the 6th adds Kuzushi on the receiver and resets the buildup', () => {
      const s = sim(-R, R)
      for (let n = 1; n <= TSUPPARI_KUZUSHI_BUILDUP; n++) {
        const after = landHit(s, 'a')
        expect(A(after).tsuppariBuildup).toBe(n)
        expect(B(after).posture.kind).toBe('stable')
        expect(B(after).externalVelocity.x).toBeCloseTo(J, 12)
      }
      const sixth = landHit(s, 'a')
      expect(A(sixth).tsuppariBuildup).toBe(0)
      expect(B(sixth).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(sixth).action.kind).toBe('idle')
      expect(B(sixth).externalVelocity.x).toBeCloseTo(J, 12) // ordinary impulse, no susceptibility
      const seventh = landHit(s, 'a')
      expect(A(seventh).tsuppariBuildup).toBe(1)
    })

    it('TS20: 5 hits -> a whiff -> the next hit is still the Kuzushi hit', () => {
      const s = sim(-R, R)
      for (let n = 0; n < TSUPPARI_KUZUSHI_BUILDUP; n++) landHit(s, 'a')
      // B walks away out of reach, then A whiffs.
      stepN(s, 80, intents({}, { move: [1, 0] }))
      stepN(s, 60)
      expect(gap(s.getSnapshot())).toBeGreaterThan(REACH)
      const whiff = toHitTick(s, { left: true }).after
      expect(strike(A(whiff))).toBe('whiff')
      expect(A(whiff).tsuppariBuildup).toBe(TSUPPARI_KUZUSHI_BUILDUP)
      const hit = landHit(s, 'a')
      expect(B(hit).posture.kind).toBe('kuzushi')
      expect(A(hit).tsuppariBuildup).toBe(0)
    })
  })

  describe('Counter', () => {
    // B Pushes A away (so A carries external momentum), A starts a Tsuppari while drifting, and B
    // Counters (or not, in the twin) once its Push is over. Returns both runs at the catch / hit tick.
    function counterScenario(attackHand: 'left' | 'right', counter: boolean) {
      const s = sim(-R, R)
      const tsuppariAt = 20
      const counterAt = PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS + PUSH_RECOVERY_TICKS // B idle again
      const hitTick = tsuppariAt + TSUPPARI_STARTUP_TICKS
      let before: BoutSnapshot = s.getSnapshot()
      let transitions = 0
      for (let t = 0; t <= hitTick; t++) {
        before = s.getSnapshot()
        s.step(
          intents(t === tsuppariAt ? { [attackHand]: true } : {}, {
            push: t === 0,
            counter: counter && t === counterAt,
          }),
        )
        if (s.getSnapshot().counterTransition.kind !== 'none') transitions++
      }
      return { s, before, after: s.getSnapshot(), transitions }
    }

    for (const attackHand of ['left', 'right'] as const) {
      it(`TS${attackHand === 'left' ? '21' : '22'} / TS23 / TS24: Counter catches a ${attackHand} Tsuppari: attacker Kuzushi in place, no transition / impulse / buildup change`, () => {
        const caught = counterScenario(attackHand, true)
        const twin = counterScenario(attackHand, false)
        // Sanity: the twin's strike lands (so the catch really replaced a hit), and A was drifting.
        expect(strike(A(twin.after))).toBe('hit')
        expect(Math.abs(A(twin.after).externalVelocity.x)).toBeGreaterThan(0.1)
        expect(gap(caught.before)).toBeLessThanOrEqual(REACH)

        const a = A(caught.after)
        const b = B(caught.after)
        expect(a.posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
        expect(a.action.kind).toBe('idle')
        expect(b.action.kind).toBe('idle')
        expect(b.posture.kind).toBe('stable')
        expect(caught.transitions).toBe(0)
        // In place: same positions / momentum as the uncountered twin (A's own strike never moves A).
        expect(a.position).toEqual(A(twin.after).position)
        expect(a.externalVelocity).toEqual(A(twin.after).externalVelocity)
        // No Tsuppari impulse on B (the twin's B got +J on this tick).
        expect(B(twin.after).externalVelocity.x - b.externalVelocity.x).toBeCloseTo(J, 9)
        expect(a.tsuppariBuildup).toBe(0)
      })
    }

    it('TS24: a Counter-caught Tsuppari neither increments nor resets an existing buildup', () => {
      const s = sim(-R, R)
      landHit(s, 'a')
      expect(A(s.getSnapshot()).tsuppariBuildup).toBe(1)
      // Settle within reach again, then A strikes with the other hand while B Counters 2 ticks later.
      for (let t = 0; t < 600; t++) {
        const snap = s.getSnapshot()
        if (ready(A(snap)) && ready(B(snap)) && isStill(A(snap)) && isStill(B(snap)) && gap(snap) <= 0.8) break
        s.step(intents({}, gap(snap) > 0.75 && ready(B(snap)) ? { move: [-1, 0] } : {}))
      }
      s.step(intents({ right: true }))
      s.step(IDLE)
      s.step(intents({}, { counter: true }))
      stepN(s, TSUPPARI_STARTUP_TICKS - 2)
      const after = s.getSnapshot()
      expect(A(after).posture.kind).toBe('kuzushi')
      expect(A(after).tsuppariBuildup).toBe(1)
      expect(B(after).externalVelocity).toEqual({ x: 0, y: 0 })
    })

    it('TS24b: a Counter catches a Tsuppari striking from the extended band (0.89 m, no body contact)', () => {
      const s = sim(0, 0.89)
      s.step(intents({ left: true }, { counter: true }))
      stepN(s, TSUPPARI_STARTUP_TICKS)
      const after = s.getSnapshot()
      expect(gap(after)).toBeCloseTo(0.89, 12)
      expect(A(after).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(after).posture.kind).toBe('stable')
      expect(B(after).externalVelocity).toEqual({ x: 0, y: 0 })
      expect(A(after).tsuppariBuildup).toBe(0)
      expect(after.counterTransition.kind).toBe('none')
    })

    it('TS25: a Counter window does not catch a whiffing Tsuppari; it runs out and fails as usual', () => {
      const s = sim(-0.5, 0.5)
      s.step(intents({ left: true }, { counter: true }))
      stepN(s, TSUPPARI_STARTUP_TICKS)
      let after = s.getSnapshot()
      expect(strike(A(after))).toBe('whiff')
      expect(A(after).posture.kind).toBe('stable')
      expect(B(after).action.kind).toBe('counter')
      stepN(s, COUNTER_WINDOW_TICKS - TSUPPARI_STARTUP_TICKS - 1)
      after = s.getSnapshot()
      expect(B(after).posture.kind).toBe('kuzushi')
      expect(A(after).posture.kind).toBe('stable')
    })

    it('TS26: Push Counter is unchanged: a Best catch in contact still starts the Counter transition', () => {
      const s = sim(-R, R)
      s.step(intents({ counter: true }, { push: true }))
      stepN(s, PUSH_STARTUP_TICKS)
      const after = s.getSnapshot()
      expect(after.counterTransition).toMatchObject({ kind: 'active', tier: 'best', counterUserId: 'a', pusherId: 'b' })
      expect(B(after).posture.kind).toBe('kuzushi')
    })
  })

  describe('pair contest', () => {
    it('TS27: Tsuppari vs Tsuppari on one tick: both hit, both pushed apart by a full impulse (no netting)', () => {
      const s = sim(-0.4, 0.4)
      const { after } = toHitTick(s, { left: true }, { right: true })
      expect(strike(A(after))).toBe('hit')
      expect(strike(B(after))).toBe('hit')
      expect(A(after).externalVelocity).toEqual({ x: -J, y: 0 })
      expect(B(after).externalVelocity).toEqual({ x: J, y: 0 })
      expect(A(after).tsuppariBuildup).toBe(1)
      expect(B(after).tsuppariBuildup).toBe(1)
      stepN(s, 120)
      const end = s.getSnapshot()
      expect(A(end).position.x + 0.4).toBeCloseTo(-(B(end).position.x - 0.4), 12)
      expect(B(end).position.x - 0.4).toBeGreaterThan(0.25)
    })

    it('TS28: participant array order does not change any result', () => {
      const script = (s: BoutSimulation) => {
        const trace: BoutSnapshot[] = []
        for (let t = 0; t < 140; t++) {
          // a: Tsuppari at 0 and Push at 40; b: Tsuppari at 0, Tsuppari at 30, Counter at 70
          s.step(intents({ left: t === 0, push: t === 40 }, { right: t === 0, left: t === 30, counter: t === 70, move: t > 20 && t < 30 ? [-1, 0] : undefined }))
          trace.push(s.getSnapshot())
        }
        return trace
      }
      const ab = script(sim(-0.4, 0.4))
      const ba = script(sim(-0.4, 0.4, { radius: 100 }, true))
      ab.forEach((snap, i) => {
        expect(A(ba[i])).toEqual(A(snap))
        expect(B(ba[i])).toEqual(B(snap))
        expect(ba[i].outcome).toEqual(snap.outcome)
        expect(ba[i].counterTransition).toEqual(snap.counterTransition)
      })
    })

    // Builds a buildup of `a` and `b` ordinary hits (B's hits first so A ends where the scenario starts).
    function withBuildups(a: number, b: number): BoutSimulation {
      const s = sim(-R, R)
      for (let n = 0; n < b; n++) landHit(s, 'b')
      for (let n = 0; n < a; n++) landHit(s, 'a')
      const snap = s.getSnapshot()
      expect(A(snap).tsuppariBuildup).toBe(a)
      expect(B(snap).tsuppariBuildup).toBe(b)
      return s
    }

    it('TS29: Kuzushi hit vs ordinary hit on one tick: both impulses land; only the 6th-hit receiver is in Kuzushi', () => {
      const s = withBuildups(TSUPPARI_KUZUSHI_BUILDUP, 2)
      const { after } = bothStrike(s)
      expect(A(after).externalVelocity.x).toBeCloseTo(-J, 12)
      expect(B(after).externalVelocity.x).toBeCloseTo(J, 12)
      expect(A(after).tsuppariBuildup).toBe(0)
      expect(B(after).tsuppariBuildup).toBe(3) // B's hit counted although B ends in Kuzushi
      expect(B(after).posture.kind).toBe('kuzushi')
      expect(A(after).posture.kind).toBe('stable')
    })

    it('TS30: Kuzushi hit vs Kuzushi hit on one tick: both impulses, both Kuzushi, both buildups reset', () => {
      const s = withBuildups(TSUPPARI_KUZUSHI_BUILDUP, TSUPPARI_KUZUSHI_BUILDUP)
      const { after } = bothStrike(s)
      expect(A(after).externalVelocity.x).toBeCloseTo(-J, 12)
      expect(B(after).externalVelocity.x).toBeCloseTo(J, 12)
      expect(A(after).posture.kind).toBe('kuzushi')
      expect(B(after).posture.kind).toBe('kuzushi')
      expect(A(after).tsuppariBuildup).toBe(0)
      expect(B(after).tsuppariBuildup).toBe(0)
    })

    function pushVsTsuppari(tsuppariAt: number) {
      const s = sim(-R, R)
      const trace: BoutSnapshot[] = [s.getSnapshot()]
      for (let t = 0; t < 160; t++) {
        s.step(intents({ push: t === 0 }, { left: t === tsuppariAt }))
        trace.push(s.getSnapshot())
      }
      return { trace, end: s.getSnapshot() }
    }
    const pushAlone = () => receiverDisplacement({ push: true }).receiver

    it('TS31: Push vs Tsuppari (same-tick start / hit during Push active): one coupled pair delta; Push still wins, reduced', () => {
      for (const tsuppariAt of [0, 2, 4, 6]) {
        const { trace, end } = pushVsTsuppari(tsuppariAt)
        const hitTick = tsuppariAt + TSUPPARI_STARTUP_TICKS + 1 // index in trace (after that step)
        const before = trace[hitTick - 1]
        const at = trace[hitTick]
        expect(strike(B(at))).toBe('hit')
        // Both get the same delta P*dt - J*share on top of the decayed shared momentum.
        expect(A(at).externalVelocity).toEqual(B(at).externalVelocity)
        const decayed = Math.max(0, B(before).externalVelocity.x - EXTERNAL_DECELERATION * TICK_SECONDS)
        expect(B(at).externalVelocity.x).toBeCloseTo(
          decayed + PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS - J * TSUPPARI_COUPLED_SHARE,
          12,
        )
        for (const snap of trace.slice(0, 40)) expect(gap(snap)).toBeLessThanOrEqual(2 * R + 1e-9) // never separated
        const displacement = B(end).position.x - R
        expect(displacement).toBeGreaterThan(0.15) // the Tsuppari user is still driven back
        expect(displacement).toBeLessThan(0.6 * pushAlone()) // ...but clearly less than unresisted
      }
    })

    it('TS32: a Tsuppari landing during Push startup is an ordinary hit on the pusher (no coupling)', () => {
      // B strikes first: its hit tick (5) is A's Push startup.
      const s = sim(-R, R)
      s.step(intents({}, { left: true }))
      s.step(intents({ push: true }))
      stepN(s, TSUPPARI_STARTUP_TICKS - 2)
      const before = s.getSnapshot()
      s.step(IDLE)
      const at = s.getSnapshot()
      expect(strike(B(at))).toBe('hit')
      // The hit tick is A's last startup tick (A's Push turns active only at its end).
      expect(A(before).action).toMatchObject({ kind: 'push', phase: 'startup', ticksRemaining: 1 })
      expect(A(at).action).toMatchObject({ kind: 'push', phase: 'active', ticksRemaining: PUSH_CHARGE_TICKS, impactTicksRemaining: null })
      expect(A(at).externalVelocity.x).toBeCloseTo(A(before).externalVelocity.x - J, 12)
      expect(B(at).externalVelocity).toEqual({ x: 0, y: 0 })
      // ACTION-10B: the knocked-back pusher's committed charge continues; its first later contact opens the
      // impact window (it was not open during the startup hit, so that hit stayed uncoupled).
      let opened = false
      for (let t = 0; t < 120; t++) {
        s.step(IDLE)
        const action = A(s.getSnapshot()).action
        if (action.kind === 'push' && action.impactTicksRemaining !== null) opened = true
      }
      expect(opened).toBe(true)
      expect(B(s.getSnapshot()).position.x).toBeGreaterThan(R) // pushed by that later impact
    })

    it('TS33: a Tsuppari landing after the Push active phase is an ordinary hit on the pusher', () => {
      const tsuppariAt = PUSH_STARTUP_TICKS + PUSH_IMPACT_TICKS - TSUPPARI_STARTUP_TICKS // hit on the 1st recovery tick
      const { trace } = pushVsTsuppari(tsuppariAt)
      const hitTick = tsuppariAt + TSUPPARI_STARTUP_TICKS + 1
      const twin = pushVsTsuppari(-1).trace // no Tsuppari
      const at = trace[hitTick]
      expect(A(at).action).toMatchObject({ kind: 'push', phase: 'recovery' })
      expect(strike(B(at))).toBe('hit')
      expect(B(at).externalVelocity).toEqual(B(twin[hitTick]).externalVelocity)
      expect(A(at).externalVelocity.x).toBeCloseTo(A(twin[hitTick]).externalVelocity.x - J, 12)
    })

    it('TS34: equal Push vs Push still cancels exactly', () => {
      const s = sim(-R, R)
      s.step(intents({ push: true }, { push: true }))
      for (let t = 0; t < 40; t++) {
        s.step(IDLE)
        const snap = s.getSnapshot()
        expect(A(snap).externalVelocity).toEqual({ x: 0, y: 0 })
        expect(B(snap).externalVelocity).toEqual({ x: 0, y: 0 })
      }
    })
  })

  describe('force / displacement', () => {
    it('TS35: representative displacement: Push ~2x old (0.533 m), Tsuppari ~old Push (0.266 m), attacker still', () => {
      const push = receiverDisplacement({ push: true })
      const tsuppari = receiverDisplacement({ left: true })
      expect(push.receiver).toBeGreaterThanOrEqual(0.5)
      expect(push.receiver).toBeLessThanOrEqual(0.57)
      expect(tsuppari.receiver).toBeGreaterThanOrEqual(0.25)
      expect(tsuppari.receiver).toBeLessThanOrEqual(0.285)
      expect(push.receiver / tsuppari.receiver).toBeGreaterThanOrEqual(1.8)
      expect(push.receiver / tsuppari.receiver).toBeLessThanOrEqual(2.2)
      expect(tsuppari.attacker).toBe(0)
    })

    it('TS36: global clamp / decay / susceptibility and Push timing are unchanged; only the Push acceleration moved', () => {
      expect(MAX_EXTERNAL_SPEED).toBe(3)
      expect(EXTERNAL_DECELERATION).toBe(8)
      expect(KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER).toBe(1.5)
      expect([PUSH_STARTUP_TICKS, PUSH_IMPACT_TICKS, PUSH_RECOVERY_TICKS]).toEqual([6, 8, 10])
      expect(PUSH_EXTERNAL_ACCELERATION).toBe(26.25)
      expect(J).toBeLessThan(MAX_EXTERNAL_SPEED)
    })

    it('TS36b: ACTION-07C2 moved only the reach; every other Tsuppari constant is unchanged', () => {
      expect([TSUPPARI_STARTUP_TICKS, TSUPPARI_ACTIVE_TICKS, TSUPPARI_RECOVERY_TICKS]).toEqual([6, 1, 9])
      expect(TSUPPARI_HAND_COOLDOWN_TICKS).toBe(60)
      expect(TSUPPARI_IMPULSE).toBe(2.13)
      expect(TSUPPARI_COUPLED_SHARE).toBe(0.5)
      expect(TSUPPARI_KUZUSHI_BUILDUP).toBe(5)
      expect(BODY_RADIUS).toBe(0.35)
      expect(COUNTER_WINDOW_TICKS).toBe(12)
    })
  })

  describe('ring-out / states', () => {
    it('TS37: a Tsuppari rings the receiver out through the normal resolver', () => {
      const s = sim(1.35, 2.1, { radius: 2.275 })
      s.step(intents({ left: true }))
      let t = 0
      while (s.getSnapshot().outcome.kind === 'ongoing' && t++ < 120) s.step(IDLE)
      expect(s.getSnapshot().outcome).toEqual({ kind: 'win', winnerId: 'a', loserId: 'b', reason: 'ring-out' })
    })

    it('TS38: simultaneous Tsuppari pushing both out on one tick is a Rematch (existing semantics)', () => {
      const s = sim(-0.4, 0.4, { radius: 0.6 })
      s.step(intents({ left: true }, { left: true }))
      let t = 0
      while (s.getSnapshot().outcome.kind === 'ongoing' && t++ < 120) s.step(IDLE)
      expect(s.getSnapshot().outcome).toEqual({ kind: 'rematch', reason: 'simultaneous-ring-out' })
    })

    it('TS39: Tsuppari edges during a Counter transition are dropped; hand cooldowns keep counting down', () => {
      const s = sim(-1.2, 1.2)
      s.step(intents({ left: true })) // tick 0: A's left goes on cooldown (whiff)
      let tick = 1
      // B walks into contact and Pushes; A Counters on the same tick (Best).
      while (gap(s.getSnapshot()) > 2 * R + 0.001) {
        s.step(intents({}, { move: [-1, 0] }))
        tick++
      }
      stepN(s, 30)
      tick += 30
      s.step(intents({ counter: true }, { push: true }))
      tick++
      stepN(s, PUSH_STARTUP_TICKS)
      tick += PUSH_STARTUP_TICKS
      expect(s.getSnapshot().counterTransition.kind).toBe('active')
      while (s.getSnapshot().counterTransition.kind === 'active') {
        s.step(intents({ left: true, right: true }, { left: true, right: true }))
        tick++
        const snap = s.getSnapshot()
        expect(kind(A(snap))).not.toBe('tsuppari')
        expect(kind(B(snap))).not.toBe('tsuppari')
        expect(A(snap).tsuppariCooldown).toEqual({ left: Math.max(0, TSUPPARI_HAND_COOLDOWN_TICKS - (tick - 1)), right: 0 })
        expect(B(snap).tsuppariCooldown).toEqual({ left: 0, right: 0 })
      }
    })

    it('TS40: Tsuppari edges while grappled are dropped', () => {
      const s = sim(-R, R)
      s.step(intents({ grip: true }))
      expect(s.getSnapshot().engagement.kind).toBe('grappled')
      for (let t = 0; t < 30; t++) {
        s.step(intents({ left: true, right: true }, { right: true }))
        const snap = s.getSnapshot()
        expect(kind(A(snap))).not.toBe('tsuppari')
        expect(kind(B(snap))).not.toBe('tsuppari')
        expect(A(snap).tsuppariCooldown).toEqual({ left: 0, right: 0 })
      }
    })

    it('TS41: Tsuppari edges during Kuzushi are dropped (not queued)', () => {
      const s = sim(-2, 2)
      s.step(intents({ counter: true }))
      stepN(s, COUNTER_WINDOW_TICKS - 1)
      expect(A(s.getSnapshot()).posture.kind).toBe('kuzushi')
      // Every full Kuzushi tick drops the edges (ticksRemaining 0 = stable again at the next tick start).
      for (let p = A(s.getSnapshot()).posture; p.kind === 'kuzushi' && p.ticksRemaining > 0; p = A(s.getSnapshot()).posture) {
        s.step(intents({ left: true, right: true }))
        expect(kind(A(s.getSnapshot()))).toBe('idle')
      }
      expect(A(s.getSnapshot()).tsuppariCooldown).toEqual({ left: 0, right: 0 })
      stepN(s, 5)
      expect(kind(A(s.getSnapshot()))).toBe('idle')
    })

    it('TS42: Tsuppari edges during another action or a recovery are dropped (not queued)', () => {
      const push = sim(-2, 2)
      push.step(intents({ push: true }))
      for (let t = 1; t < PUSH_STARTUP_TICKS + PUSH_CHARGE_TICKS + PUSH_RECOVERY_TICKS - 1; t++) {
        push.step(intents({ left: true }))
        expect(kind(A(push.getSnapshot()))).toBe('push')
      }
      push.step(intents({ left: true })) // the last Push tick: still dropped
      expect(kind(A(push.getSnapshot()))).toBe('idle')
      expect(A(push.getSnapshot()).tsuppariCooldown).toEqual({ left: 0, right: 0 })

      const grip = sim(-2, 2)
      grip.step(intents({ grip: true }))
      while (kind(A(grip.getSnapshot())) === 'grip') grip.step(intents({ left: true }))
      expect(A(grip.getSnapshot()).tsuppariCooldown).toEqual({ left: 0, right: 0 })

      const own = sim(-2, 2)
      own.step(intents({ left: true }))
      for (let t = 1; t < TOTAL - 1; t++) {
        own.step(intents({ right: true }))
        expect(hand(A(own.getSnapshot()))).toBe('left')
      }
      own.step(intents({ right: true })) // the last recovery tick: still dropped
      expect(kind(A(own.getSnapshot()))).toBe('idle')
      expect(A(own.getSnapshot()).tsuppariCooldown.right).toBe(0)
    })

    it('TS43: once decided, step() is a no-op for Tsuppari edges and cooldowns', () => {
      const s = sim(1.35, 2.1, { radius: 2.275 })
      s.step(intents({ left: true }))
      while (s.getSnapshot().outcome.kind === 'ongoing') s.step(IDLE)
      const frozen = s.getSnapshot()
      expect(A(frozen).tsuppariCooldown.left).toBeGreaterThan(0)
      stepN(s, 10, intents({ left: true, right: true }, { left: true, right: true }))
      expect(s.getSnapshot()).toEqual(frozen)
    })

    it('TS44: Snapshot action / cooldown / buildup are deep copies', () => {
      const s = sim(-R, R)
      s.step(intents({ left: true }))
      const snap = s.getSnapshot()
      const a = A(snap) as unknown as {
        tsuppariCooldown: { left: number }
        tsuppariBuildup: number
        action: { hand: string; strike: string }
      }
      a.tsuppariCooldown.left = 0
      a.tsuppariBuildup = 9
      a.action.hand = 'right'
      a.action.strike = 'hit'
      const fresh = A(s.getSnapshot())
      expect(fresh.tsuppariCooldown.left).toBe(TSUPPARI_HAND_COOLDOWN_TICKS)
      expect(fresh.tsuppariBuildup).toBe(0)
      expect(fresh.action).toMatchObject({ kind: 'tsuppari', hand: 'left', strike: 'pending' })
    })
  })
})
