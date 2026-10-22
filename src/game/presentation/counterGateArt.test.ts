import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, COUNTER_WINDOW_TICKS } from '../sumo/BoutSimulation.ts'
import type { BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import { COUNTER_GATE_ART, allCounterGateArts, selectWrestlerPoseArt } from './counterGateArt.ts'
import gateSource from './counterGateArt.ts?raw'
import { PRODUCT_TSUPPARI_ART, allProductTsuppariArts } from './productTsuppariArt.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin } from './productWrestlerArt.ts'
import { resolveWrestlerVisualState } from './wrestlerVisualState.ts'

const intent = (i: { counter?: boolean; left?: boolean } = {}): ParticipantIntent => ({
  move: { x: 0, y: 0 },
  pushPressed: false,
  tsuppariLeftPressed: i.left ?? false,
  tsuppariRightPressed: false,
  counterPressed: i.counter ?? false,
  gripPressed: false,
  driveHeld: false,
})
const intents = (a: { counter?: boolean; left?: boolean } = {}): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', intent(a)],
    ['b', intent()],
  ])
const newSim = () =>
  new BoutSimulation({
    arena: { radius: 100 },
    participants: [
      { id: 'a', position: { x: -1.2 * BODY_RADIUS, y: 0 } },
      { id: 'b', position: { x: 1.2 * BODY_RADIUS, y: 0 } },
    ],
  })
const visualOf = (s: BoutSnapshot, moving = false) =>
  resolveWrestlerVisualState(s.participants[0], s.participants[1], s.engagement, s.outcome, moving)

describe('Counter art Visual Gate (ACTION-08A)', () => {
  it('two provisional textures under counter-gate/, distinct from the idle and Tsuppari Product art', () => {
    expect(allCounterGateArts().map((a) => a.assetPath)).toEqual([
      'assets/action/wrestler/counter-gate/red.png',
      'assets/action/wrestler/counter-gate/blue.png',
    ])
    const others = [...Object.values(PRODUCT_WRESTLER_ART), ...allProductTsuppariArts()]
    for (const art of allCounterGateArts()) {
      expect(others.map((o) => o.textureKey)).not.toContain(art.textureKey)
      expect(others.map((o) => o.assetPath)).not.toContain(art.assetPath)
    }
  })

  it('explicit pivot / body core; blue = red reflected across the local X axis', () => {
    const { red, blue } = COUNTER_GATE_ART
    expect([red.width, red.height, red.pivot]).toEqual([210, 207, { x: 74, y: 115 }])
    expect([blue.width, blue.height, blue.pivot]).toEqual([red.width, red.height, { x: red.pivot.x, y: red.height - red.pivot.y }])
    for (const art of allCounterGateArts()) {
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(origin.y * art.height).toBeCloseTo(art.pivot.y, 9)
      expect(art.bodyCoreDiameterPx).toBe(PRODUCT_WRESTLER_ART[art.id].bodyCoreDiameterPx)
    }
  })

  it('shows the Counter candidate exactly while the visual pose is counter, then the idle sprite again', () => {
    const sim = newSim()
    const { red, blue } = PRODUCT_WRESTLER_ART
    expect(selectWrestlerPoseArt(red, visualOf(sim.getSnapshot()))).toBe(red)
    sim.step(intents({ counter: true }))
    let held = 0
    while (visualOf(sim.getSnapshot()).pose === 'counter' && held < 100) {
      const visual = visualOf(sim.getSnapshot())
      expect(sim.getSnapshot().participants[0].action.kind).toBe('counter')
      expect(selectWrestlerPoseArt(red, visual)).toBe(COUNTER_GATE_ART.red)
      expect(selectWrestlerPoseArt(blue, visual)).toBe(COUNTER_GATE_ART.blue)
      held++
      sim.step(intents())
    }
    // the press tick already advanced one tick of the window; no presentation timer extends it
    expect(held).toBe(COUNTER_WINDOW_TICKS - 1)
    const after = visualOf(sim.getSnapshot())
    expect(after.pose).not.toBe('counter')
    expect(selectWrestlerPoseArt(blue, after)).not.toBe(COUNTER_GATE_ART.blue)
  })

  it('Tsuppari still selects its permanent Product pose; idle / move use the idle sprite', () => {
    const sim = newSim()
    const s0 = sim.getSnapshot()
    for (const moving of [false, true]) {
      const visual = visualOf(s0, moving)
      expect(selectWrestlerPoseArt(PRODUCT_WRESTLER_ART.blue, visual)).toBe(PRODUCT_WRESTLER_ART.blue)
    }
    sim.step(intents({ left: true }))
    const visual = visualOf(sim.getSnapshot())
    expect(visual.pose).toBe('tsuppari')
    expect(selectWrestlerPoseArt(PRODUCT_WRESTLER_ART.blue, visual)).toBe(PRODUCT_TSUPPARI_ART.blue.left)
    expect(selectWrestlerPoseArt(PRODUCT_WRESTLER_ART.red, visual)).toBe(PRODUCT_TSUPPARI_ART.red.left)
  })

  it('selection is presentation only: the Snapshot is unchanged', () => {
    const sim = newSim()
    sim.step(intents({ counter: true }))
    const before = JSON.stringify(sim.getSnapshot())
    selectWrestlerPoseArt(PRODUCT_WRESTLER_ART.red, visualOf(sim.getSnapshot()))
    expect(JSON.stringify(sim.getSnapshot())).toBe(before)
  })

  it('stays Phaser-free and Simulation-free', () => {
    expect(gateSource).not.toMatch(/from ['"]phaser['"]/)
    expect(gateSource).not.toMatch(/BoutSimulation/)
  })
})
