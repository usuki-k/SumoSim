import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  PUSH_CHARGE_TICKS,
  TSUPPARI_STARTUP_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import {
  GRIP_ATTEMPT_GATE_ART,
  allGripAttemptGateArts,
  selectWrestlerDisplayArt,
} from './gripAttemptGateArt.ts'
import gateSource from './gripAttemptGateArt.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import { PRODUCT_COUNTER_ART, allProductCounterArts, counterVisualRotationOffset } from './productCounterArt.ts'
import { kuzushiSweatVisual } from './kuzushiVisualEffect.ts'
import { PRODUCT_TSUPPARI_ART, allProductTsuppariArts } from './productTsuppariArt.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin } from './productWrestlerArt.ts'
import { resolveWrestlerVisualState } from './wrestlerVisualState.ts'

type Input = {
  counter?: boolean
  left?: boolean
  push?: boolean
  grip?: boolean
  move?: [number, number]
}
const intent = (i: Input = {}): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  tsuppariLeftPressed: i.left ?? false,
  tsuppariRightPressed: false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: false,
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
const isGate = (art: { textureKey: string }) => allGripAttemptGateArts().some((g) => g.textureKey === art.textureKey)

describe('Grip attempt gate art (ACTION-11A)', () => {
  it('two temporary gate textures under grip-attempt-gate/, distinct from every Product texture', () => {
    expect(allGripAttemptGateArts().map((a) => a.assetPath)).toEqual([
      'assets/action/wrestler/grip-attempt-gate/red.png',
      'assets/action/wrestler/grip-attempt-gate/blue.png',
    ])
    const others = [...Object.values(PRODUCT_WRESTLER_ART), ...allProductTsuppariArts(), ...allProductCounterArts()]
    for (const art of allGripAttemptGateArts()) {
      expect(others.map((o) => o.textureKey)).not.toContain(art.textureKey)
      expect(others.map((o) => o.assetPath)).not.toContain(art.assetPath)
    }
  })

  it('explicit pivot / body core; blue = red reflected across the local X axis', () => {
    const gate = GRIP_ATTEMPT_GATE_ART
    expect([gate.red.width, gate.red.height, gate.red.pivot]).toEqual([195, 190, { x: 81, y: 105 }])
    expect([gate.blue.width, gate.blue.height, gate.blue.pivot]).toEqual([
      gate.red.width,
      gate.red.height,
      { x: gate.red.pivot.x, y: gate.red.height - gate.red.pivot.y },
    ])
    for (const art of allGripAttemptGateArts()) {
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(origin.y * art.height).toBeCloseTo(art.pivot.y, 9)
      expect(art.bodyCoreDiameterPx).toBe(PRODUCT_WRESTLER_ART[art.id].bodyCoreDiameterPx)
    }
  })

  it('A1-A4 / W1-W3: attempt art exactly through Grip reach; whiff recovery and idle use the idle sprite', () => {
    const sim = newSim(FAR) // beyond the lunge: the reach whiffs
    expect(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))).toBe(red) // A1
    sim.step(intents({ grip: true }))
    let reach = 0
    while (visualOf(sim.getSnapshot()).gripPhase === 'reach') {
      const visual = visualOf(sim.getSnapshot())
      expect(visual.pose).toBe('grip') // A2
      expect(selectWrestlerDisplayArt(red, visual)).toBe(GRIP_ATTEMPT_GATE_ART.red) // A3
      expect(selectWrestlerDisplayArt(blue, visual)).toBe(GRIP_ATTEMPT_GATE_ART.blue) // A4
      reach++
      sim.step(intents())
    }
    // the press tick already advanced one reach tick; no presentation timer extends it
    expect(reach).toBe(GRIP_REACH_TICKS - 1)
    let recovery = 0
    while (visualOf(sim.getSnapshot()).gripPhase === 'recovery') {
      const visual = visualOf(sim.getSnapshot())
      expect(visual.pose).toBe('grip') // W1
      expect(selectWrestlerDisplayArt(red, visual)).toBe(red) // W2
      expect(selectWrestlerDisplayArt(blue, visual)).toBe(blue)
      recovery++
      sim.step(intents())
    }
    expect(recovery).toBe(GRIP_RECOVERY_TICKS)
    const after = visualOf(sim.getSnapshot())
    expect(after.pose).toBe('idle') // W3
    expect(selectWrestlerDisplayArt(red, after)).toBe(red)
  })

  it('A5: both participants reaching independently show their own attempt texture', () => {
    const sim = newSim(FAR)
    sim.step(intents({ grip: true }, { grip: true }))
    const s = sim.getSnapshot()
    expect(selectWrestlerDisplayArt(red, visualOf(s, 0))).toBe(GRIP_ATTEMPT_GATE_ART.red)
    expect(selectWrestlerDisplayArt(blue, visualOf(s, 1))).toBe(GRIP_ATTEMPT_GATE_ART.blue)
  })

  it('S1-S3: a Grip that lands during reach enters the grapple and drops the attempt art on that tick', () => {
    // A lunges from just beyond its own lunge reach; B walks in during the reach (ACTION-11C: contact success)
    const sim = newSim(COMBINED + 0.11)
    sim.step(intents({ grip: true }, { move: [-1, 0] }))
    let shown = 0
    while (sim.getSnapshot().engagement.kind === 'free' && shown < GRIP_REACH_TICKS) {
      expect(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))).toBe(GRIP_ATTEMPT_GATE_ART.red)
      shown++
      sim.step(intents({}, { move: [-1, 0] }))
    }
    const s = sim.getSnapshot()
    expect(shown).toBeGreaterThan(0)
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } }) // S1
    for (const who of [0, 1] as const) {
      const visual = visualOf(s, who)
      expect(visual.pose).toBe('grapple')
      const idle = who === 0 ? red : blue
      expect(selectWrestlerDisplayArt(idle, visual)).toBe(idle) // S2 / S3: the existing grapple fallback (idle sprite)
    }
  })

  it('S4: Kuzushi Grip -> Morozashi is unchanged; the attempt art disappears once the grapple starts', () => {
    // B whiffs a Counter (-> Kuzushi at the end of its window) while A is already reaching in contact
    const sim = newSim(COMBINED)
    sim.step(intents({}, { counter: true }))
    for (let t = 1; t < COUNTER_WINDOW_TICKS - 2; t++) sim.step(intents())
    sim.step(intents({ grip: true }))
    let shown = 0
    while (sim.getSnapshot().engagement.kind === 'free' && shown < GRIP_REACH_TICKS) {
      expect(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))).toBe(GRIP_ATTEMPT_GATE_ART.red)
      shown++
      sim.step(intents())
    }
    const s = sim.getSnapshot()
    expect(shown).toBeGreaterThan(0)
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
    expect(s.participants[1].posture).toEqual({ kind: 'stable' })
    expect(selectWrestlerDisplayArt(red, visualOf(s, 0))).toBe(red)
    expect(selectWrestlerDisplayArt(blue, visualOf(s, 1))).toBe(blue)
  })

  it('R1 / R2 / R4: Tsuppari / Counter / Kuzushi presentation is the existing selection', () => {
    const tsuppari = newSim(FAR)
    tsuppari.step(intents({ left: true }))
    expect(selectWrestlerDisplayArt(red, visualOf(tsuppari.getSnapshot()))).toBe(PRODUCT_TSUPPARI_ART.red.left)
    expect(selectWrestlerDisplayArt(blue, visualOf(tsuppari.getSnapshot()))).toBe(PRODUCT_TSUPPARI_ART.blue.left)

    const counter = newSim(FAR)
    counter.step(intents({ counter: true }))
    const cv = visualOf(counter.getSnapshot())
    expect(selectWrestlerDisplayArt(red, cv)).toBe(PRODUCT_COUNTER_ART.red)
    expect(selectWrestlerDisplayArt(blue, cv)).toBe(PRODUCT_COUNTER_ART.blue)
    expect(counterVisualRotationOffset('red', cv)).not.toBe(0)

    for (let t = 1; t < COUNTER_WINDOW_TICKS; t++) counter.step(intents())
    const kv = visualOf(counter.getSnapshot())
    expect(kv.pose).toBe('kuzushi')
    expect(selectWrestlerDisplayArt(red, kv)).toBe(red)
    expect(kuzushiSweatVisual('red', kv).visible).toBe(true)
  })

  it('R3: Push (24-tick charge) keeps the idle sprite through startup, charge and recovery', () => {
    const sim = newSim(FAR + 5)
    sim.step(intents({ push: true }))
    let pushTicks = 0
    while (visualOf(sim.getSnapshot()).pose === 'push') {
      expect(isGate(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot())))).toBe(false)
      expect(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))).toBe(red)
      pushTicks++
      sim.step(intents())
    }
    expect(pushTicks).toBeGreaterThan(PUSH_CHARGE_TICKS)
  })

  it('V6 (ACTION-11C): a Grip started in contact shows the attempt for the minimum attempt, then the grapple fallback', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }))
    const keys: string[] = []
    while (sim.getSnapshot().engagement.kind === 'free') {
      keys.push(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot())).textureKey)
      sim.step(intents())
    }
    expect(keys).toEqual(Array(GRIP_MIN_ATTEMPT_TICKS).fill(GRIP_ATTEMPT_GATE_ART.red.textureKey))
    expect(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))).toBe(red)
  })

  it('V6 (ACTION-11C): a Tsuppari hit that defeats the reach switches to the idle sprite on that tick', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }, { left: true }))
    const seen: string[] = []
    for (let t = 1; t <= TSUPPARI_STARTUP_TICKS; t++) {
      seen.push(selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot())).textureKey)
      sim.step(intents())
    }
    expect(seen).toEqual(Array(TSUPPARI_STARTUP_TICKS).fill(GRIP_ATTEMPT_GATE_ART.red.textureKey))
    const s = sim.getSnapshot()
    expect(visualOf(s)).toMatchObject({ pose: 'grip', gripPhase: 'recovery' })
    expect(selectWrestlerDisplayArt(red, visualOf(s))).toBe(red)
  })

  it('selection is presentation only: the Snapshot is unchanged', () => {
    const sim = newSim(FAR)
    sim.step(intents({ grip: true }))
    const before = JSON.stringify(sim.getSnapshot())
    selectWrestlerDisplayArt(red, visualOf(sim.getSnapshot()))
    expect(JSON.stringify(sim.getSnapshot())).toBe(before)
  })

  it('stays Phaser-free and Simulation-free; WrestlerView preloads and selects through the gate', () => {
    expect(gateSource).not.toMatch(/from ['"]phaser['"]/)
    expect(gateSource).not.toMatch(/BoutSimulation/)
    expect(viewSource).toMatch(/allGripAttemptGateArts\(\)/)
    expect(viewSource).toMatch(/this\.show\(selectWrestlerDisplayArt\(this\.idleArt, state\)\)/)
  })
})
