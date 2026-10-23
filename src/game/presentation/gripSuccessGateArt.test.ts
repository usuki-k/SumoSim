import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  PUSH_CHARGE_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import { GRIP_ATTEMPT_GATE_ART, allGripAttemptGateArts } from './gripAttemptGateArt.ts'
import {
  GRIP_SUCCESS_GATE_ART,
  GRIP_SUCCESS_LATERAL_OFFSET_R,
  allGripSuccessGateArts,
  gripSuccessDisplayOffsetPx,
  selectWrestlerArt,
} from './gripSuccessGateArt.ts'
import gateSource from './gripSuccessGateArt.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import { PRODUCT_COUNTER_ART, allProductCounterArts, counterVisualRotationOffset } from './productCounterArt.ts'
import { kuzushiSweatVisual } from './kuzushiVisualEffect.ts'
import { PRODUCT_TSUPPARI_ART, allProductTsuppariArts } from './productTsuppariArt.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin, productWrestlerScale } from './productWrestlerArt.ts'
import { resolveWrestlerVisualState } from './wrestlerVisualState.ts'

type Input = {
  counter?: boolean
  left?: boolean
  push?: boolean
  grip?: boolean
  drive?: boolean
  move?: [number, number]
}
const intent = (i: Input = {}): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  tsuppariLeftPressed: i.left ?? false,
  tsuppariRightPressed: false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: i.drive ?? false,
})
const intents = (a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', intent(a)],
    ['b', intent(b)],
  ])
const COMBINED = 2 * BODY_RADIUS
// Beyond the ~0.10 m Grip lunge (ACTION-11C): a Grip from here whiffs.
const FAR = COMBINED + 0.6
const setupAt = (gap: number): BoutSetup => ({
  arena: { radius: 100 },
  participants: [
    { id: 'a', position: { x: -gap / 2, y: 0 } },
    { id: 'b', position: { x: gap / 2, y: 0 } },
  ],
})
const newSim = (gap: number) => new BoutSimulation(setupAt(gap))
const visualOf = (s: BoutSnapshot, who: 0 | 1 = 0) =>
  resolveWrestlerVisualState(s.participants[who], s.participants[1 - who], s.engagement, s.outcome, false)
const { red, blue } = PRODUCT_WRESTLER_ART
const idleOf = (who: 0 | 1) => (who === 0 ? red : blue)
const artOf = (s: BoutSnapshot, who: 0 | 1) => selectWrestlerArt(idleOf(who), visualOf(s, who))
const isSuccess = (art: { textureKey: string }) =>
  allGripSuccessGateArts().some((g) => g.textureKey === art.textureKey)

// A Grip from contact: the minimum attempt, then a neutral grapple (ACTION-11C).
function neutralGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  return sim
}

// B whiffs a Counter (-> Kuzushi), A Grips the Kuzushi side in contact: Morozashi with A as holder.
function morozashiGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({}, { counter: t === 0 }))
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  return sim
}

describe('Grip success gate art (ACTION-11D)', () => {
  it('two temporary gate textures under grip-success-gate/, distinct from every other texture', () => {
    expect(allGripSuccessGateArts().map((a) => a.assetPath)).toEqual([
      'assets/action/wrestler/grip-success-gate/red.png',
      'assets/action/wrestler/grip-success-gate/blue.png',
    ])
    const others = [
      ...Object.values(PRODUCT_WRESTLER_ART),
      ...allProductTsuppariArts(),
      ...allProductCounterArts(),
      ...allGripAttemptGateArts(),
    ]
    for (const art of allGripSuccessGateArts()) {
      expect(others.map((o) => o.textureKey)).not.toContain(art.textureKey)
      expect(others.map((o) => o.assetPath)).not.toContain(art.assetPath)
    }
  })

  it('explicit pivot / body core; blue = red reflected across the local X axis; scale matches the idle sprite', () => {
    const gate = GRIP_SUCCESS_GATE_ART
    expect([gate.red.width, gate.red.height, gate.red.pivot]).toEqual([160, 183, { x: 83, y: 98 }])
    expect([gate.blue.width, gate.blue.height, gate.blue.pivot]).toEqual([
      gate.red.width,
      gate.red.height,
      { x: gate.red.pivot.x, y: gate.red.height - gate.red.pivot.y },
    ])
    for (const art of allGripSuccessGateArts()) {
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(origin.y * art.height).toBeCloseTo(art.pivot.y, 9)
      expect(art.bodyCoreDiameterPx).toBe(PRODUCT_WRESTLER_ART[art.id].bodyCoreDiameterPx)
      // the body core maps to 2R exactly like the idle sprite, so the texture swap does not change the body size
      expect(productWrestlerScale(art, 40)).toBeCloseTo(productWrestlerScale(PRODUCT_WRESTLER_ART[art.id], 40), 12)
    }
  })

  it('S1-S3: idle -> idle art; Grip reach -> attempt art; whiff recovery -> idle art', () => {
    const sim = newSim(FAR)
    expect(artOf(sim.getSnapshot(), 0)).toBe(red) // S1
    sim.step(intents({ grip: true }))
    let reach = 0
    while (visualOf(sim.getSnapshot()).gripPhase === 'reach') {
      expect(artOf(sim.getSnapshot(), 0)).toBe(GRIP_ATTEMPT_GATE_ART.red) // S2
      reach++
      sim.step(intents())
    }
    expect(reach).toBe(GRIP_REACH_TICKS - 1)
    let recovery = 0
    while (visualOf(sim.getSnapshot()).gripPhase === 'recovery') {
      expect(artOf(sim.getSnapshot(), 0)).toBe(red) // S3
      recovery++
      sim.step(intents())
    }
    expect(recovery).toBe(GRIP_RECOVERY_TICKS)
    expect(artOf(sim.getSnapshot(), 0)).toBe(red)
  })

  it('S4: attempt -> success on the grapple tick, for both wrestlers on the same tick', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }))
    const keys: string[][] = []
    while (sim.getSnapshot().engagement.kind === 'free') {
      const s = sim.getSnapshot()
      keys.push([artOf(s, 0).textureKey, artOf(s, 1).textureKey])
      sim.step(intents())
    }
    expect(keys).toEqual(Array(GRIP_MIN_ATTEMPT_TICKS).fill([GRIP_ATTEMPT_GATE_ART.red.textureKey, blue.textureKey]))
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
    expect(visualOf(s, 0).pose).toBe('grapple')
    expect(visualOf(s, 1).pose).toBe('grapple')
    expect(artOf(s, 0)).toBe(GRIP_SUCCESS_GATE_ART.red)
    expect(artOf(s, 1)).toBe(GRIP_SUCCESS_GATE_ART.blue)
  })

  it('S4: a Grip that lands from a lunge also switches both wrestlers to the success art', () => {
    const sim = newSim(COMBINED + 0.11)
    sim.step(intents({ grip: true }, { move: [-1, 0] }))
    while (sim.getSnapshot().engagement.kind === 'free') sim.step(intents({}, { move: [-1, 0] }))
    const s = sim.getSnapshot()
    expect(artOf(s, 0)).toBe(GRIP_SUCCESS_GATE_ART.red)
    expect(artOf(s, 1)).toBe(GRIP_SUCCESS_GATE_ART.blue)
  })

  it('S5: Morozashi holder and disadvantaged both use the same success art', () => {
    const s = morozashiGrapple().getSnapshot()
    expect(visualOf(s, 0).grappleRole).toBe('morozashi-holder')
    expect(visualOf(s, 1).grappleRole).toBe('morozashi-disadvantaged')
    expect(artOf(s, 0)).toBe(GRIP_SUCCESS_GATE_ART.red)
    expect(artOf(s, 1)).toBe(GRIP_SUCCESS_GATE_ART.blue)
  })

  it('S6 / S7: Drive pressed, held and released keeps the success art (no flicker to idle)', () => {
    const sim = neutralGrapple()
    const poses = new Set<string>()
    for (let k = 0; k < 40; k++) {
      sim.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
      const s = sim.getSnapshot()
      if (s.engagement.kind !== 'grappled') break
      for (const who of [0, 1] as const) {
        poses.add(visualOf(s, who).pose)
        expect(isSuccess(artOf(s, who))).toBe(true)
      }
    }
    expect(poses).toContain('drive') // S6
    for (let k = 0; k < 10; k++) {
      sim.step(intents())
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('grappled')
      expect(visualOf(s, 0).pose).toBe('grapple') // S7
      expect(artOf(s, 0)).toBe(GRIP_SUCCESS_GATE_ART.red)
      expect(artOf(s, 1)).toBe(GRIP_SUCCESS_GATE_ART.blue)
    }
  })

  it('S8 / S9: release drops the success art on the release tick; recovery and the other side use idle art', () => {
    for (const make of [neutralGrapple, morozashiGrapple]) {
      const sim = make()
      sim.step(intents({ grip: true }))
      let s = sim.getSnapshot()
      expect(s.engagement).toEqual({ kind: 'free' })
      expect(visualOf(s, 0)).toMatchObject({ pose: 'grip', gripPhase: 'recovery' })
      expect(artOf(s, 0)).toBe(red) // S8: not the success art, not the attempt art
      expect(artOf(s, 1)).toBe(blue)
      for (let k = 0; k < GRIP_RECOVERY_TICKS; k++) {
        s = sim.getSnapshot()
        expect(artOf(s, 0)).toBe(red) // S9
        expect(artOf(s, 1)).toBe(blue)
        sim.step(intents())
      }
      expect(visualOf(sim.getSnapshot(), 0).pose).toBe('idle')
    }
  })

  it('a later new Grip after a release shows the attempt art again', () => {
    const sim = neutralGrapple()
    sim.step(intents({ grip: true }))
    for (let k = 0; k < GRIP_RECOVERY_TICKS + 2; k++) sim.step(intents())
    sim.step(intents({ grip: true }))
    expect(artOf(sim.getSnapshot(), 0)).toBe(GRIP_ATTEMPT_GATE_ART.red)
  })

  it('R1-R5: Tsuppari / Counter / Kuzushi / Push / Grip attempt presentation is the existing selection', () => {
    const tsuppari = newSim(FAR)
    tsuppari.step(intents({ left: true }))
    expect(artOf(tsuppari.getSnapshot(), 0)).toBe(PRODUCT_TSUPPARI_ART.red.left) // R1
    expect(selectWrestlerArt(blue, visualOf(tsuppari.getSnapshot()))).toBe(PRODUCT_TSUPPARI_ART.blue.left)

    const counter = newSim(FAR)
    counter.step(intents({ counter: true }))
    const cv = visualOf(counter.getSnapshot())
    expect(selectWrestlerArt(red, cv)).toBe(PRODUCT_COUNTER_ART.red) // R2
    expect(selectWrestlerArt(blue, cv)).toBe(PRODUCT_COUNTER_ART.blue)
    expect(counterVisualRotationOffset('red', cv)).not.toBe(0)

    for (let t = 1; t < COUNTER_WINDOW_TICKS; t++) counter.step(intents())
    const kv = visualOf(counter.getSnapshot())
    expect(kv.pose).toBe('kuzushi')
    expect(selectWrestlerArt(red, kv)).toBe(red) // R3
    expect(kuzushiSweatVisual('red', kv).visible).toBe(true)

    const push = newSim(FAR + 5)
    push.step(intents({ push: true }))
    let pushTicks = 0
    while (visualOf(push.getSnapshot()).pose === 'push') {
      expect(artOf(push.getSnapshot(), 0)).toBe(red) // R4
      pushTicks++
      push.step(intents())
    }
    expect(pushTicks).toBeGreaterThan(PUSH_CHARGE_TICKS)

    const attempt = newSim(FAR)
    attempt.step(intents({ grip: true }, { grip: true }))
    expect(artOf(attempt.getSnapshot(), 0)).toBe(GRIP_ATTEMPT_GATE_ART.red) // R5
    expect(artOf(attempt.getSnapshot(), 1)).toBe(GRIP_ATTEMPT_GATE_ART.blue)
  })

  it('selection is presentation only: the Snapshot is unchanged', () => {
    const sim = neutralGrapple()
    const before = JSON.stringify(sim.getSnapshot())
    artOf(sim.getSnapshot(), 0)
    artOf(sim.getSnapshot(), 1)
    expect(JSON.stringify(sim.getSnapshot())).toBe(before)
  })

  describe('pair display offset (ACTION-11E)', () => {
    const R_PX = 40
    const offsetOf = (s: BoutSnapshot, who: 0 | 1) =>
      gripSuccessDisplayOffsetPx(visualOf(s, who), s.participants[who].facing, R_PX)
    const isZero = (o: { x: number; y: number }) => o.x === 0 && o.y === 0

    it('a small lateral offset to the own LEFT of each wrestler, perpendicular to its canonical facing', () => {
      expect(GRIP_SUCCESS_LATERAL_OFFSET_R).toBeLessThan(0)
      expect(Math.abs(GRIP_SUCCESS_LATERAL_OFFSET_R)).toBeLessThanOrEqual(0.5)
      const s = neutralGrapple().getSnapshot()
      for (const who of [0, 1] as const) {
        const o = offsetOf(s, who)
        const f = s.participants[who].facing
        expect(Math.hypot(o.x, o.y)).toBeCloseTo(Math.abs(GRIP_SUCCESS_LATERAL_OFFSET_R) * R_PX, 9)
        expect(o.x * Math.cos(f) + o.y * Math.sin(f)).toBeCloseTo(0, 9) // no forward component
        expect(-o.x * Math.sin(f) + o.y * Math.cos(f)).toBeLessThan(0) // along the wrestler's LEFT
      }
    })

    it('face to face the pair shifts point-symmetrically (opposite offsets, pair midpoint kept)', () => {
      const s = neutralGrapple().getSnapshot()
      const a = offsetOf(s, 0)
      const b = offsetOf(s, 1)
      expect(a.x + b.x).toBeCloseTo(0, 9)
      expect(a.y + b.y).toBeCloseTo(0, 9)
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * Math.abs(GRIP_SUCCESS_LATERAL_OFFSET_R) * R_PX, 9)
    })

    it('applies exactly while the success art is shown: grapple, Drive and Morozashi', () => {
      const sim = neutralGrapple()
      for (let k = 0; k < 40; k++) {
        sim.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
        const s = sim.getSnapshot()
        for (const who of [0, 1] as const) {
          expect(isSuccess(artOf(s, who))).toBe(!isZero(offsetOf(s, who)))
          expect(isZero(offsetOf(s, who))).toBe(false)
        }
      }
      const m = morozashiGrapple().getSnapshot()
      expect(isZero(offsetOf(m, 0)) || isZero(offsetOf(m, 1))).toBe(false)
    })

    it('zero for idle, Grip attempt, whiff / release recovery and every other action', () => {
      const attempt = newSim(COMBINED)
      attempt.step(intents({ grip: true }))
      while (attempt.getSnapshot().engagement.kind === 'free') {
        const s = attempt.getSnapshot()
        expect(artOf(s, 0)).toBe(GRIP_ATTEMPT_GATE_ART.red)
        expect(isZero(offsetOf(s, 0))).toBe(true)
        expect(isZero(offsetOf(s, 1))).toBe(true)
        attempt.step(intents())
      }
      attempt.step(intents({ grip: true })) // release
      for (let k = 0; k <= GRIP_RECOVERY_TICKS; k++) {
        const s = attempt.getSnapshot()
        expect(s.engagement.kind).toBe('free')
        expect(isZero(offsetOf(s, 0)) && isZero(offsetOf(s, 1))).toBe(true)
        attempt.step(intents())
      }
      const free = newSim(FAR)
      const seen = new Set<string>()
      const steps: Input[] = [{ left: true }, ...Array(40).fill({}), { counter: true }, ...Array(120).fill({}), { push: true }]
      for (const step of [...steps, ...Array(60).fill({})]) {
        free.step(intents(step))
        const v = visualOf(free.getSnapshot())
        seen.add(v.pose)
        expect(isZero(gripSuccessDisplayOffsetPx(v, free.getSnapshot().participants[0].facing, R_PX))).toBe(true)
      }
      expect([...seen]).toEqual(expect.arrayContaining(['tsuppari', 'counter', 'kuzushi', 'push', 'idle']))
    })

    it('display only: the Snapshot positions / bond distance are unchanged', () => {
      const sim = neutralGrapple()
      const before = JSON.stringify(sim.getSnapshot())
      offsetOf(sim.getSnapshot(), 0)
      offsetOf(sim.getSnapshot(), 1)
      const s = sim.getSnapshot()
      expect(JSON.stringify(s)).toBe(before)
      const [a, b] = s.participants
      expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeCloseTo(COMBINED, 9)
    })
  })

  it('stays Phaser-free and Simulation-free; WrestlerView preloads and selects through the success gate', () => {
    expect(gateSource).not.toMatch(/from ['"]phaser['"]/)
    expect(gateSource).not.toMatch(/BoutSimulation/)
    expect(viewSource).toMatch(/allGripSuccessGateArts\(\)/)
    expect(viewSource).toMatch(/this\.show\(selectWrestlerArt\(this\.idleArt, state\)\)/)
    // ACTION-11E: body and shadow share the success display offset
    expect(viewSource).toMatch(/gripSuccessDisplayOffsetPx\(state, participant\.facing, this\.R\)/)
    expect(viewSource).toMatch(/setPosition\(positionPx\.x \+ display\.x, positionPx\.y \+ display\.y\)/)
    expect(viewSource).toMatch(/positionPx\.x \+ display\.x \+ SHADOW_OFFSET\.x/)
  })
})
