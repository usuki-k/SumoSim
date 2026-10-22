import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  CONTACT_SLOP,
  COUNTER_BEST_TICKS,
  EXTERNAL_DECELERATION,
  FORWARD_ACCELERATION,
  KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER,
  KUZUSHI_TICKS,
  MAX_EXTERNAL_SPEED,
  MAX_SPEED,
  PUSH_CHARGE_TICKS,
  PUSH_EXTERNAL_ACCELERATION,
  PUSH_IMPACT_TICKS,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  STOP_DECELERATION,
  TICK_SECONDS,
  TSUPPARI_STARTUP_TICKS,
} from './BoutSimulation.ts'
import type { ArenaSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from './BoutTypes.ts'

// Push charge (ACTION-10B): startup 6 -> committed charge (<= 24) -> first contact opens an 8-tick impact
// window -> recovery 10. Numbered cases follow the Task's required boundary list (M / I / F / D / C / PP / PT / K / R / G).

const R = BODY_RADIUS
const COMBINED = 2 * R
const RING = 2.275
const CIRCLE: ArenaSetup = { radius: RING }
const TOKUDAWARA: ArenaSetup = { radius: RING, tokudawara: { depth: 0.1194375, halfAngle: Math.PI / 20 } }
const WHIFF_TICKS = PUSH_STARTUP_TICKS + PUSH_CHARGE_TICKS + PUSH_RECOVERY_TICKS

interface Input {
  move?: [number, number]
  push?: boolean
  left?: boolean
  counter?: boolean
}
const one = (i: Input): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  tsuppariLeftPressed: i.left ?? false,
  tsuppariRightPressed: false,
  counterPressed: i.counter ?? false,
  gripPressed: false,
  driveHeld: false,
})
const intents = (a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
const sim = (a: [number, number], b: [number, number], arena: ArenaSetup = { radius: 100 }, swap = false) => {
  const pa = { id: 'a', position: { x: a[0], y: a[1] } }
  const pb = { id: 'b', position: { x: b[0], y: b[1] } }
  return new BoutSimulation({ arena, participants: swap ? [pb, pa] : [pa, pb] })
}
const A = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'a') as ParticipantState
const B = (s: BoutSnapshot) => s.participants.find((p) => p.id === 'b') as ParticipantState
const gap = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const inContact = (s: BoutSnapshot) => gap(s) <= COMBINED + CONTACT_SLOP
const push = (p: ParticipantState) => (p.action.kind === 'push' ? p.action : null)
const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y)

// A pushes on tick 0 toward B; B holds `bInput(t)`; returns every Snapshot after tick t (index t).
function run(s: BoutSimulation, ticks: number, bInput: (t: number) => Input = () => ({}), aInput: (t: number) => Input = () => ({})) {
  const snaps: BoutSnapshot[] = []
  for (let t = 0; t < ticks; t++) {
    s.step(intents({ ...aInput(t), push: t === 0 || aInput(t).push === true }, bInput(t)))
    snaps.push(s.getSnapshot())
  }
  return snaps
}

describe('Push charge (ACTION-10B)', () => {
  describe('timing / travel (M)', () => {
    const snaps = run(sim([0, 0], [50, 0]), WHIFF_TICKS + 5)
    // the phase applying to tick k is the phase reported after tick k - 1 (tick 0 is startup)
    const applied = ['startup', ...snaps.slice(0, -1).map((s) => push(A(s))?.phase ?? 'idle')]

    it('M1 / M2 / M3 / M6: startup 6, no-contact charge 24, recovery 10, then idle', () => {
      expect([PUSH_STARTUP_TICKS, PUSH_CHARGE_TICKS, PUSH_IMPACT_TICKS, PUSH_RECOVERY_TICKS]).toEqual([6, 24, 8, 10])
      expect(applied.slice(0, WHIFF_TICKS)).toEqual([
        ...Array(PUSH_STARTUP_TICKS).fill('startup'),
        ...Array(PUSH_CHARGE_TICKS).fill('active'),
        ...Array(PUSH_RECOVERY_TICKS).fill('recovery'),
      ])
      expect(applied[WHIFF_TICKS]).toBe('idle')
    })

    it('M4 / M5: open-space travel ~0.938 m (7.4x the old 0.1267 m); peak self speed reaches MAX_SPEED, not above', () => {
      const travel = A(snaps[snaps.length - 1]).position.x
      expect(travel).toBeCloseTo(0.938333, 5)
      const peak = Math.max(...snaps.map((s) => speed(A(s).velocity)))
      expect(peak).toBeCloseTo(MAX_SPEED, 12)
      expect(peak).toBeLessThanOrEqual(MAX_SPEED + 1e-12)
      expect(snaps.every((s) => speed(A(s).externalVelocity) === 0)).toBe(true)
    })
  })

  describe('impact window (I)', () => {
    it('I1 / I2: no impact during startup or a no-contact charge (null throughout)', () => {
      const snaps = run(sim([0, 0], [50, 0]), WHIFF_TICKS)
      for (const s of snaps) {
        const p = push(A(s))
        if (p) expect(p.impactTicksRemaining).toBeNull()
      }
    })

    it('I3 / I4 / I5 / I7 / I8: the first contact opens 8 on that tick and pushes; it counts down to recovery; no charge resumes', () => {
      const s = sim([0, 0], [0.8, 0])
      const snaps = run(s, 60)
      const first = snaps.findIndex(inContact)
      expect(first).toBe(13)
      expect(push(A(snaps[first - 1]))?.impactTicksRemaining).toBeNull()
      // opened at 8 on the contact tick, already counted once at its end (ticks left including the next one)
      expect(push(A(snaps[first]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1)
      expect(B(snaps[first]).externalVelocity.x).toBeCloseTo(PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS, 12) // I4
      for (let k = 1; k < PUSH_IMPACT_TICKS - 1; k++) expect(push(A(snaps[first + k]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1 - k)
      const expiry = first + PUSH_IMPACT_TICKS - 1
      expect(push(A(snaps[expiry]))).toMatchObject({ phase: 'recovery', ticksRemaining: PUSH_RECOVERY_TICKS, impactTicksRemaining: 0 })
      // I8: recovery runs out and the Push ends; the unused charge never resumes
      for (let k = 1; k < PUSH_RECOVERY_TICKS; k++) expect(push(A(snaps[expiry + k]))?.phase).toBe('recovery')
      expect(A(snaps[expiry + PUSH_RECOVERY_TICKS]).action).toEqual({ kind: 'idle' })
    })

    it('I6: losing contact inside the window neither pauses, resets nor reopens it', () => {
      // late sidestep: a glancing contact, then B escapes sideways while the window keeps counting
      const s = sim([0, 0], [0.8, 0])
      const snaps = run(s, 60, (t) => (t >= 6 ? { move: [0, 1] } : {}))
      const first = snaps.findIndex(inContact)
      expect(first).toBe(14)
      const window = snaps.slice(first, first + PUSH_IMPACT_TICKS - 1)
      expect(window.some((x) => !inContact(x))).toBe(true)
      window.forEach((x, k) => expect(push(A(x))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1 - k))
      expect(push(A(snaps[first + PUSH_IMPACT_TICKS - 1]))?.phase).toBe('recovery')
      // later contacts during recovery never reopen it
      for (const x of snaps.slice(first + PUSH_IMPACT_TICKS - 1)) {
        const p = push(A(x))
        if (p) expect(p.impactTicksRemaining).toBe(0)
      }
    })

    it('I9: a contact-start Push reproduces the 8-force-tick shove baseline', () => {
      const s = sim([-R, 0], [R, 0])
      const snaps = run(s, 200)
      let forceTicks = 0
      let prev = 0
      for (const x of snaps) {
        const v = B(x).externalVelocity.x
        if (v > prev + 1e-12) forceTicks++
        prev = v
      }
      expect(forceTicks).toBe(PUSH_IMPACT_TICKS)
      expect(Math.max(...snaps.map((x) => B(x).externalVelocity.x))).toBeCloseTo(2.566667, 5)
      expect(B(snaps[snaps.length - 1]).position.x - R).toBeCloseTo(0.5325, 6)
      expect(push(A(snaps[PUSH_STARTUP_TICKS]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1) // opened on the first active tick
    })
  })

  describe('facing / no-homing (F)', () => {
    it('F1 / F2 / F3 / F4: facing locked to the Push direction for the whole Push; resumes after idle', () => {
      const s = sim([0, 0], [0.8, 0])
      const snaps = run(s, 60, () => ({ move: [0, 1] })) // perfect read: B sidesteps from the press tick
      const first = push(A(snaps[0]))
      expect(first?.direction).toEqual({ x: 1, y: 0 }) // F1: from the press-time facing (toward B)
      let pushTicks = 0
      for (const x of snaps) {
        const p = push(A(x))
        if (!p) break
        pushTicks++
        expect(p.direction).toEqual({ x: 1, y: 0 })
        expect(A(x).facing).toBe(0) // F2 / F3: no turn toward the sidestepping B
        expect(A(x).position.y).toBe(0) // the path stays on the locked line
        if (speed(A(x).velocity) > 0) expect(Math.atan2(A(x).velocity.y, A(x).velocity.x)).toBe(0)
      }
      expect(pushTicks).toBe(WHIFF_TICKS - 1)
      expect(snaps.some(inContact)).toBe(false)
      const after = snaps[WHIFF_TICKS]
      expect(A(after).action.kind).toBe('idle')
      expect(A(after).facing).toBeCloseTo(Math.atan2(B(after).position.y - A(after).position.y, B(after).position.x - A(after).position.x), 12) // F4
    })
  })

  describe('dodge matrix (D1-D16, ordinary Move only)', () => {
    // [separation, reaction start tick (0 = press, 6 = first charge tick, 9 = +3, 12 = +6), expected first contact or null]
    const cases: [number, number, number | null][] = [
      [0.8, 0, null], [0.8, 6, 14], [0.8, 9, 13], [0.8, 12, 13],
      [0.9, 0, null], [0.9, 6, 18], [0.9, 9, 17], [0.9, 12, 17],
      [1.0, 0, null], [1.0, 6, null], [1.0, 9, 20], [1.0, 12, 20],
      [1.1, 0, null], [1.1, 6, null], [1.1, 9, 24], [1.1, 12, 22],
    ]
    for (const [sep, start, expected] of cases) {
      it(`D: separation ${sep} m, reaction from tick ${start} -> ${expected === null ? 'MISS' : `HIT at ${expected}`}`, () => {
        const snaps = run(sim([0, 0], [sep, 0]), 80, (t) => (t >= start ? { move: [0, 1] } : {}))
        const first = snaps.findIndex(inContact)
        const impact = snaps.some((x) => push(A(x))?.impactTicksRemaining !== null && push(A(x)) !== null)
        const force = snaps.some((x) => speed(B(x).externalVelocity) > 0)
        const minDistance = Math.min(...snaps.map(gap))
        if (expected === null) {
          expect(first).toBe(-1)
          expect(minDistance).toBeGreaterThan(COMBINED + CONTACT_SLOP)
          expect(impact || force).toBe(false)
          expect(A(snaps[snaps.length - 1]).position.x).toBeCloseTo(0.938333, 5) // the miss runs the whole commitment
        } else {
          expect(first).toBe(expected)
          expect(impact).toBe(true)
          expect(force).toBe(true)
          expect(minDistance).toBeLessThanOrEqual(COMBINED + CONTACT_SLOP)
        }
      })
    }
  })

  describe('Counter (C)', () => {
    // A charges from `sep`; B presses Counter on tick c. Returns the outcome.
    function counterAt(sep: number, c: number) {
      const s = sim([0, 0], [sep, 0])
      for (let t = 0; t < 80; t++) {
        s.step(intents({ push: t === 0 }, { counter: t === c }))
        const snap = s.getSnapshot()
        if (snap.counterTransition.kind === 'active') return { tier: snap.counterTransition.tier, t, snap }
        if (B(snap).posture.kind === 'kuzushi') return { tier: 'fail' as const, t, snap }
      }
      return { tier: 'none' as const, t: -1, snap: s.getSnapshot() }
    }

    it('C1: a no-contact charge cannot be Counter-caught (the window fails into self Kuzushi)', () => {
      for (const c of [0, 6, 12, 18, 24]) expect(counterAt(2.0, c).tier).toBe('fail')
    })

    it('C2 / C3 / C5: after a long run-up the first contact tick opens the impact before Counter: Best', () => {
      const first = run(sim([0, 0], [0.9, 0]), 40).findIndex(inContact)
      expect(first).toBe(17)
      for (let k = 0; k < COUNTER_BEST_TICKS; k++) {
        const r = counterAt(0.9, first + k)
        expect(r.tier).toBe('best')
        expect(r.t).toBe(first + k)
      }
      expect(counterAt(0.9, first - 6).tier).toBe('best') // window opened before contact, catches the contact tick
    })

    it('C4: later impact ticks are Success; C6: the result / transition / Kuzushi are unchanged', () => {
      const first = 17
      for (let k = COUNTER_BEST_TICKS; k < PUSH_IMPACT_TICKS; k++) expect(counterAt(0.9, first + k).tier).toBe('success')
      const r = counterAt(0.9, first)
      expect(r.snap.counterTransition).toMatchObject({ kind: 'active', tier: 'best', counterUserId: 'b', pusherId: 'a' })
      expect(A(r.snap).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(B(r.snap).action).toEqual({ kind: 'idle' })
      expect(counterAt(0.9, first + PUSH_IMPACT_TICKS).tier).toBe('fail') // recovery is not catchable
    })
  })

  describe('Push vs Push (PP)', () => {
    function clash(swap: boolean) {
      const s = sim([-0.5, 0], [0.5, 0], { radius: 100 }, swap)
      const snaps: BoutSnapshot[] = []
      for (let t = 0; t < 60; t++) {
        s.step(intents({ push: t === 0 }, { push: t === 0 }))
        snaps.push(s.getSnapshot())
      }
      return snaps
    }

    it('PP1 / PP2: both charges meet, both windows open on one tick and the Push force cancels (no one-sided shove)', () => {
      const snaps = clash(false)
      const first = snaps.findIndex(inContact)
      expect(first).toBeGreaterThan(PUSH_STARTUP_TICKS)
      expect(push(A(snaps[first]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1)
      expect(push(B(snaps[first]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1)
      for (const x of snaps) {
        expect(A(x).externalVelocity).toEqual({ x: 0, y: 0 })
        expect(B(x).externalVelocity).toEqual({ x: 0, y: 0 })
      }
      expect(A(snaps[snaps.length - 1]).position.x + B(snaps[snaps.length - 1]).position.x).toBeCloseTo(0, 12)
    })

    it('PP3: participant order does not change the clash', () => {
      const a = clash(false)
      const b = clash(true)
      for (let i = 0; i < a.length; i++) {
        expect(A(b[i])).toEqual(A(a[i]))
        expect(B(b[i])).toEqual(B(a[i]))
      }
    })

    it('PP2: a long run-up alone does not multiply the Push force (same per-tick gain, 8 force ticks)', () => {
      const snaps = run(sim([0, 0], [0.8, 0]), 80)
      const first = snaps.findIndex(inContact)
      expect(B(snaps[first]).externalVelocity.x).toBeCloseTo(PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS, 12)
      let forceTicks = 0
      let prev = 0
      for (const x of snaps) {
        const v = B(x).externalVelocity.x
        if (v > prev + 1e-12) forceTicks++
        prev = v
      }
      expect(forceTicks).toBeLessThanOrEqual(PUSH_IMPACT_TICKS)
      expect(Math.max(...snaps.map((x) => B(x).externalVelocity.x))).toBeLessThanOrEqual(MAX_EXTERNAL_SPEED)
    })
  })

  describe('Push vs Tsuppari (PT)', () => {
    // A charges from `sep`; B fires a left Tsuppari on tick k. 'C' coupled (pair delta), 'H' ordinary hit, 'w' whiff.
    function hitKind(sep: number, k: number): string {
      const s = sim([0, 0], [sep, 0])
      for (let t = 0; t < 60; t++) {
        const before = s.getSnapshot()
        s.step(intents({ push: t === 0 }, { left: t === k }))
        const after = s.getSnapshot()
        const pb = B(before).action
        const pa = B(after).action
        if (pb.kind === 'tsuppari' && pb.strike === 'pending' && pa.kind === 'tsuppari' && pa.strike !== 'pending') {
          if (pa.strike === 'whiff') return 'w'
          const dA = A(after).externalVelocity.x - A(before).externalVelocity.x
          const dB = B(after).externalVelocity.x - B(before).externalVelocity.x
          return Math.abs(dA - dB) < 1e-9 ? 'C' : 'H'
        }
      }
      return '-'
    }

    it('PT1: a hit during the no-contact charge is an ordinary hit (no coupling)', () => {
      // sep 0.85: in Tsuppari reach (0.90) but not in contact (0.70) during the early charge
      expect(hitKind(0.85, 0)).toBe('H')
      const s = sim([0, 0], [0.85, 0])
      for (let t = 0; t <= TSUPPARI_STARTUP_TICKS; t++) s.step(intents({ push: t === 0 }, { left: t === 0 }))
      expect(push(A(s.getSnapshot()))?.impactTicksRemaining).toBeNull()
    })

    it('PT2 / PT3: in contact during the impact window the hit is coupled; the coupled ticks are bounded by 8', () => {
      const row = Array.from({ length: 30 }, (_, k) => hitKind(0.8, k)).join('')
      const coupled = row.split('').filter((x) => x === 'C').length
      expect(coupled).toBeGreaterThan(0)
      expect(coupled).toBeLessThanOrEqual(PUSH_IMPACT_TICKS)
      expect(row).toMatch(/^[Hw]*C+[Hw]*$/) // one contiguous coupled stretch
    })
  })

  describe('Kuzushi (K, ACTION-09B preserved)', () => {
    function kuzushiB(sep: number): BoutSimulation {
      const s = sim([0, 0], [sep, 0])
      for (let t = 0; t < 12; t++) s.step(intents({}, { counter: t === 0 }))
      expect(B(s.getSnapshot()).posture.kind).toBe('kuzushi')
      return s
    }

    it('K1: a charge without impact does not consume Kuzushi', () => {
      const s = kuzushiB(2.0)
      for (let t = 0; t < WHIFF_TICKS; t++) {
        s.step(intents({ push: t === 0 }))
        expect(B(s.getSnapshot()).posture.kind).toBe('kuzushi')
      }
    })

    it('K2 / K3 / K4: the first impact force tick is 1.5x and consumes; later impact ticks are 1.0x', () => {
      const s = kuzushiB(0.8)
      const snaps: BoutSnapshot[] = []
      for (let t = 0; t < 40; t++) {
        s.step(intents({ push: t === 0 }))
        snaps.push(s.getSnapshot())
      }
      const first = snaps.findIndex(inContact)
      expect(B(snaps[first - 1]).posture.kind).toBe('kuzushi')
      expect(B(snaps[first]).externalVelocity.x).toBeCloseTo(PUSH_EXTERNAL_ACCELERATION * KUZUSHI_FOLLOWUP_FORCE_MULTIPLIER * TICK_SECONDS, 12)
      expect(B(snaps[first]).posture.kind).toBe('stable')
      const d2 = B(snaps[first + 1]).externalVelocity.x - B(snaps[first]).externalVelocity.x
      expect(d2).toBeCloseTo((PUSH_EXTERNAL_ACCELERATION - EXTERNAL_DECELERATION) * TICK_SECONDS, 12)
    })
  })

  describe('ring-out (R)', () => {
    // A charges along +x on the chord y = y0; B stands `margin` inside the boundary, `ahead` in front of A.
    function edge(arena: ArenaSetup, y0: number, margin: number, bInput: (t: number) => Input, bPushAt = -1) {
      const xb = Math.sqrt(RING * RING - y0 * y0) - margin
      const s = sim([xb - 0.8, y0], [xb, y0], arena)
      const snaps: BoutSnapshot[] = []
      for (let t = 0; t < 150; t++) {
        s.step(intents({ push: t === 0 }, { ...bInput(t), push: t === bPushAt }))
        snaps.push(s.getSnapshot())
        if (s.getSnapshot().outcome.kind !== 'ongoing') break
      }
      return snaps
    }

    it('R1: a safely central whiff stays IN', () => {
      const s = sim([-0.4, 0], [0.4, 0], TOKUDAWARA)
      for (let t = 0; t < 80; t++) s.step(intents({ push: t === 0 }, { move: [0, t < 30 ? -1 : 0] }))
      expect(s.getSnapshot().outcome).toEqual({ kind: 'ongoing' })
    })

    it('R2 / R3 / R4: a near-edge early sidestep makes the committed charge carry the attacker out (ordinary ring-out)', () => {
      for (const arena of [CIRCLE, TOKUDAWARA]) {
        const snaps = edge(arena, 1.0, 0.1, () => ({ move: [0, -1] }))
        const last = snaps[snaps.length - 1]
        expect(snaps.some(inContact)).toBe(false)
        expect(last.outcome).toEqual({ kind: 'win', winnerId: 'b', loserId: 'a', reason: 'ring-out' })
        expect(snaps.length - 1).toBe(33)
        expect(push(A(last))?.phase).toBe('recovery')
      }
    })

    it('R4: the Tokudawara window widens the allowed radius as before (the direct hit inside it goes out later)', () => {
      const circle = edge(CIRCLE, 0, 0.1, () => ({}))
      const toku = edge(TOKUDAWARA, 0, 0.1, () => ({}))
      expect(circle[circle.length - 1].outcome).toMatchObject({ loserId: 'b', reason: 'ring-out' })
      expect(toku[toku.length - 1].outcome).toMatchObject({ loserId: 'b', reason: 'ring-out' })
      expect(toku.length).toBeGreaterThan(circle.length)
    })

    it('R5: a direct near-edge hit drives the defender out with the existing 8-tick impact (no extra tuning)', () => {
      const snaps = edge(CIRCLE, 1.0, 0.1, () => ({}))
      const first = snaps.findIndex(inContact)
      expect(first).toBe(13)
      const last = snaps[snaps.length - 1]
      expect(last.outcome).toEqual({ kind: 'win', winnerId: 'a', loserId: 'b', reason: 'ring-out' })
      expect(snaps.length - 1).toBe(19)
      expect(push(A(last))?.impactTicksRemaining).toBeGreaterThan(0) // still inside the impact window
    })

    it('R6: a near-edge Push-vs-Push clash cancels the Push force while both windows are active', () => {
      for (const bPushAt of [0, 3, 6]) {
        const snaps = edge(CIRCLE, 0, 0.1, () => ({}), bPushAt)
        const first = snaps.findIndex(inContact)
        expect(push(A(snaps[first]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1)
        expect(push(B(snaps[first]))?.impactTicksRemaining).toBe(PUSH_IMPACT_TICKS - 1)
        for (const x of snaps) expect(B(x).externalVelocity).toEqual({ x: 0, y: 0 })
        expect(snaps[snaps.length - 1].outcome).toEqual({ kind: 'ongoing' })
      }
    })
  })

  describe('regression (G5)', () => {
    it('G5: idle movement globals are unchanged', () => {
      expect([FORWARD_ACCELERATION, MAX_SPEED, STOP_DECELERATION, PUSH_EXTERNAL_ACCELERATION, EXTERNAL_DECELERATION, MAX_EXTERNAL_SPEED]).toEqual([
        10, 3, 24, 26.25, 8, 3,
      ])
    })
  })
})
