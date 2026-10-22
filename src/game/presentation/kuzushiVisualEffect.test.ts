import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  KUZUSHI_TICKS,
  PUSH_STARTUP_TICKS,
  TSUPPARI_KUZUSHI_BUILDUP,
  TSUPPARI_STARTUP_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from '../sumo/BoutTypes.ts'
import { KUZUSHI_SWEAT_DROPS, kuzushiSweatOffsetPx, kuzushiSweatVisual } from './kuzushiVisualEffect.ts'
import effectSource from './kuzushiVisualEffect.ts?raw'
import { PRODUCT_COUNTER_ART, counterVisualRotationOffset, selectWrestlerPoseArt } from './productCounterArt.ts'
import { PRODUCT_TSUPPARI_ART } from './productTsuppariArt.ts'
import { PRODUCT_WRESTLER_ART } from './productWrestlerArt.ts'
import { resolveWrestlerVisualState, type WrestlerVisualState } from './wrestlerVisualState.ts'

const R = BODY_RADIUS

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
const sim = (ax: number, bx: number) =>
  new BoutSimulation({
    arena: { radius: 100 },
    participants: [
      { id: 'a', position: { x: ax, y: 0 } },
      { id: 'b', position: { x: bx, y: 0 } },
    ],
  })
const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const vis = (s: BoutSnapshot, which: 0 | 1): WrestlerVisualState =>
  resolveWrestlerVisualState(s.participants[which], s.participants[1 - which], s.engagement, s.outcome, false)
// blue = wrestler-a / 'a', red = wrestler-b / 'b' (Scene assignment); the effect semantics do not depend on it.
const sweatA = (s: BoutSnapshot) => kuzushiSweatVisual('blue', vis(s, 0))
const sweatB = (s: BoutSnapshot) => kuzushiSweatVisual('red', vis(s, 1))
const kuzushiTicks = (p: ParticipantState) => (p.posture.kind === 'kuzushi' ? p.posture.ticksRemaining : NaN)

describe('Kuzushi sweat Visual Gate (ACTION-09A): pure parameters', () => {
  const base = vis(sim(-2, 2).getSnapshot(), 0)
  const kuzushi = (strength: number): WrestlerVisualState => ({ ...base, pose: 'kuzushi', kuzushiStrength: strength })

  it('hidden with alpha 0 outside Kuzushi (every non-Kuzushi pose)', () => {
    for (const pose of ['idle', 'move', 'push', 'tsuppari', 'counter', 'grip', 'grapple', 'drive'] as const) {
      for (const id of ['red', 'blue'] as const) {
        expect(kuzushiSweatVisual(id, { ...base, pose, kuzushiStrength: 1 })).toMatchObject({ visible: false, alpha: 0 })
      }
    }
  })

  it('alpha = clamp(kuzushiStrength, 0, 1): fresh 1, half 0.5, near recovery -> 0', () => {
    expect(kuzushiSweatVisual('red', kuzushi(1))).toMatchObject({ visible: true, alpha: 1 })
    expect(kuzushiSweatVisual('red', kuzushi(0.5)).alpha).toBeCloseTo(0.5, 12)
    expect(kuzushiSweatVisual('red', kuzushi(1 / KUZUSHI_TICKS)).alpha).toBeCloseTo(1 / 30, 12)
    expect(kuzushiSweatVisual('red', kuzushi(0))).toMatchObject({ visible: false, alpha: 0 })
    expect(kuzushiSweatVisual('red', kuzushi(1.4)).alpha).toBe(1)
    expect(kuzushiSweatVisual('red', kuzushi(-0.2)).alpha).toBe(0)
  })

  it('deterministic R-relative drops; blue mirrors red laterally (its art is the reflected red)', () => {
    expect(KUZUSHI_SWEAT_DROPS.red).toEqual([
      { forwardR: 0.9, lateralR: 0.62, widthR: 0.2, heightR: 0.34 },
      { forwardR: 0.78, lateralR: -0.13, widthR: 0.15, heightR: 0.26 },
    ])
    expect(KUZUSHI_SWEAT_DROPS.blue).toEqual(KUZUSHI_SWEAT_DROPS.red.map((d) => ({ ...d, lateralR: -d.lateralR })))
    for (const id of ['red', 'blue'] as const) {
      expect(kuzushiSweatVisual(id, kuzushi(0.7))).toEqual({ visible: true, alpha: 0.7, drops: KUZUSHI_SWEAT_DROPS[id] })
    }
  })

  it('world placement rotates with the canonical facing (local +X = front, +Y = right)', () => {
    const drop = KUZUSHI_SWEAT_DROPS.red[0]
    const Rpx = 61.5
    const at0 = kuzushiSweatOffsetPx(drop, 0, Rpx)
    expect(at0.x).toBeCloseTo(0.9 * Rpx, 9)
    expect(at0.y).toBeCloseTo(0.62 * Rpx, 9)
    const atPi = kuzushiSweatOffsetPx(drop, Math.PI, Rpx)
    expect(atPi.x).toBeCloseTo(-0.9 * Rpx, 9)
    expect(atPi.y).toBeCloseTo(-0.62 * Rpx, 9)
    const at90 = kuzushiSweatOffsetPx(drop, Math.PI / 2, Rpx)
    expect(at90.x).toBeCloseTo(-0.62 * Rpx, 9)
    expect(at90.y).toBeCloseTo(0.9 * Rpx, 9)
    for (const f of [0, 0.3, 2, -1.2]) {
      const o = kuzushiSweatOffsetPx(drop, f, Rpx)
      expect(Math.hypot(o.x, o.y)).toBeCloseTo(Math.hypot(0.9, 0.62) * Rpx, 9)
    }
  })

  it('uses no time / delta input and stays Phaser-free and Simulation-free', () => {
    expect(effectSource).not.toMatch(/from ['"]phaser['"]/)
    expect(effectSource).not.toMatch(/BoutSimulation|performance\.now|Date\.now|delta/)
    expect(kuzushiSweatVisual.length).toBe(2)
  })

  it('body selection / Counter rotation / art metadata are untouched by the effect', () => {
    const k = kuzushi(1)
    expect(selectWrestlerPoseArt(PRODUCT_WRESTLER_ART.red, k)).toBe(PRODUCT_WRESTLER_ART.red)
    expect(counterVisualRotationOffset('red', k)).toBe(0)
    expect([PRODUCT_COUNTER_ART.red.width, PRODUCT_COUNTER_ART.red.pivot]).toEqual([210, { x: 74, y: 115 }])
    expect([PRODUCT_TSUPPARI_ART.blue.left.width, PRODUCT_TSUPPARI_ART.blue.left.pivot]).toEqual([193, { x: 79, y: 76 }])
    expect([PRODUCT_WRESTLER_ART.blue.width, PRODUCT_WRESTLER_ART.blue.pivot]).toEqual([158, { x: 82, y: 83 }])
  })
})

describe('Kuzushi sweat Visual Gate (ACTION-09A): every Kuzushi entry', () => {
  it('A. Counter Fail: full on entry, fades with ticksRemaining, gone on recovery', () => {
    const s = sim(-2, 2)
    for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) s.step(intents({ counter: t === 0 }))
    expect(A(s.getSnapshot()).posture.kind).toBe('kuzushi')
    const alphas: number[] = []
    while (A(s.getSnapshot()).posture.kind === 'kuzushi') {
      const snap = s.getSnapshot()
      const sweat = sweatA(snap)
      expect(sweat.visible).toBe(sweat.alpha > 0)
      expect(sweat.alpha).toBeCloseTo(Math.min(1, kuzushiTicks(A(snap)) / KUZUSHI_TICKS), 12)
      expect(sweatB(snap).visible).toBe(false)
      alphas.push(sweat.alpha)
      s.step(intents())
    }
    expect(alphas[0]).toBe(1)
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThan(alphas[i - 1])
    expect(alphas[alphas.length - 1]).toBeLessThanOrEqual(1 / KUZUSHI_TICKS + 1e-12)
    expect(sweatA(s.getSnapshot())).toMatchObject({ visible: false, alpha: 0 })
  })

  it('B. Counter catches Tsuppari: sweat on the attacker only', () => {
    const s = sim(0, 0.89)
    s.step(intents({ left: true }, { counter: true }))
    for (let t = 0; t < TSUPPARI_STARTUP_TICKS; t++) s.step(intents())
    const snap = s.getSnapshot()
    expect(A(snap).posture.kind).toBe('kuzushi')
    expect(sweatA(snap)).toMatchObject({ visible: true, alpha: 1 })
    expect(sweatB(snap)).toMatchObject({ visible: false, alpha: 0 })
  })

  it('C. Tsuppari 6th hit: sweat on the receiver', () => {
    const s = sim(-R, R)
    const ready = (p: ParticipantState) => p.action.kind === 'idle' && p.posture.kind === 'stable'
    const still = (p: ParticipantState) => Math.hypot(p.velocity.x, p.velocity.y) === 0
    let hits = 0
    for (let t = 0; t < 4000 && hits <= TSUPPARI_KUZUSHI_BUILDUP; t++) {
      const snap = s.getSnapshot()
      const a = A(snap)
      const b = B(snap)
      const gap = b.position.x - a.position.x
      let ai: Input = {}
      if (ready(a) && ready(b) && gap <= 0.8 && still(a) && still(b)) {
        if (a.tsuppariCooldown.left === 0) ai = { left: true }
        else if (a.tsuppariCooldown.right === 0) ai = { right: true }
      }
      s.step(intents(ai, gap > 0.75 && ready(b) ? { move: [-1, 0] } : {}))
      const after = s.getSnapshot()
      if (a.action.kind === 'tsuppari' && a.action.strike === 'pending') {
        const now = A(after)
        if (now.action.kind === 'tsuppari' && now.action.strike === 'hit') hits++
      }
      if (hits === TSUPPARI_KUZUSHI_BUILDUP + 1) {
        expect(B(after).posture.kind).toBe('kuzushi')
        expect(sweatB(after)).toMatchObject({ visible: true, alpha: 1 })
        expect(sweatA(after).visible).toBe(false)
      } else {
        expect(sweatB(after).visible).toBe(B(after).posture.kind === 'kuzushi')
      }
    }
    expect(hits).toBe(TSUPPARI_KUZUSHI_BUILDUP + 1)
  })

  it('D. Push Counter Best: full through the paused transition, then fades over a fresh 30-tick Kuzushi', () => {
    const s = sim(-R, R)
    s.step(intents({ counter: true }, { push: true }))
    for (let t = 0; t < PUSH_STARTUP_TICKS; t++) s.step(intents())
    let snap = s.getSnapshot()
    expect(snap.counterTransition).toMatchObject({ kind: 'active', pusherId: 'b', counterUserId: 'a' })
    let transitionTicks = 0
    while (s.getSnapshot().counterTransition.kind === 'active') {
      snap = s.getSnapshot()
      expect(B(snap).posture.kind).toBe('kuzushi')
      expect(sweatB(snap)).toMatchObject({ visible: true, alpha: 1 }) // timer paused -> full
      expect(sweatA(snap).visible).toBe(false) // the Counter user never gets the sweat
      transitionTicks++
      s.step(intents())
    }
    expect(transitionTicks).toBeGreaterThan(0)
    expect(transitionTicks).toBeLessThanOrEqual(COUNTER_TRANSITION_TICKS)
    snap = s.getSnapshot()
    expect(kuzushiTicks(B(snap))).toBe(KUZUSHI_TICKS) // fresh full Kuzushi after the transition
    expect(sweatB(snap).alpha).toBe(1)
    const alphas: number[] = []
    while (B(s.getSnapshot()).posture.kind === 'kuzushi') {
      alphas.push(sweatB(s.getSnapshot()).alpha)
      s.step(intents())
    }
    for (let i = 1; i < alphas.length; i++) expect(alphas[i]).toBeLessThan(alphas[i - 1])
    expect(sweatB(s.getSnapshot()).visible).toBe(false)
  })

  it('E. Grip consumes Kuzushi: the sweat disappears on that tick', () => {
    const s = sim(-R, R)
    for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) s.step(intents({}, { counter: t === 0 }))
    expect(sweatB(s.getSnapshot()).visible).toBe(true)
    s.step(intents({ grip: true }))
    const snap = s.getSnapshot()
    expect(snap.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(sweatB(snap)).toMatchObject({ visible: false, alpha: 0 })
    expect(sweatA(snap).visible).toBe(false)
  })
})
