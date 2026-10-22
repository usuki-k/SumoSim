import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, TSUPPARI_ACTIVE_TICKS, TSUPPARI_RECOVERY_TICKS, TSUPPARI_STARTUP_TICKS } from '../sumo/BoutSimulation.ts'
import type { BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin } from './productWrestlerArt.ts'
import * as productTsuppari from './productTsuppariArt.ts'
import { PRODUCT_TSUPPARI_ART, allProductTsuppariArts, selectWrestlerArt } from './productTsuppariArt.ts'
import artSource from './productTsuppariArt.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import { resolveWrestlerVisualState } from './wrestlerVisualState.ts'

const intent = (left = false, right = false): ParticipantIntent => ({
  move: { x: 0, y: 0 },
  pushPressed: false,
  tsuppariLeftPressed: left,
  tsuppariRightPressed: right,
  counterPressed: false,
  gripPressed: false,
  driveHeld: false,
})
const intents = (left = false, right = false): Map<ParticipantId, ParticipantIntent> =>
  new Map([
    ['a', intent(left, right)],
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
const visualOf = (s: BoutSnapshot) =>
  resolveWrestlerVisualState(s.participants[0], s.participants[1], s.engagement, s.outcome, false)

describe('Product Tsuppari art (ACTION-07D)', () => {
  it('exactly four textures under tsuppari/, none overwrites the idle sprites', () => {
    const arts = allProductTsuppariArts()
    expect(arts.map((a) => a.assetPath).sort()).toEqual([
      'assets/action/wrestler/tsuppari/blue_left.png',
      'assets/action/wrestler/tsuppari/blue_right.png',
      'assets/action/wrestler/tsuppari/red_left.png',
      'assets/action/wrestler/tsuppari/red_right.png',
    ])
    expect(new Set(arts.map((a) => a.textureKey)).size).toBe(4)
    const idle = Object.values(PRODUCT_WRESTLER_ART)
    for (const art of arts) {
      expect(idle.map((i) => i.assetPath)).not.toContain(art.assetPath)
      expect(idle.map((i) => i.textureKey)).not.toContain(art.textureKey)
    }
  })

  it('accepted geometry: explicit pivot inside each texture and the idle body-core scale', () => {
    const geometry = Object.fromEntries(
      allProductTsuppariArts().map((a) => [`${a.id}_${a.textureKey.endsWith('left') ? 'left' : 'right'}`, [a.width, a.height, a.pivot.x, a.pivot.y]]),
    )
    expect(geometry).toEqual({
      red_left: [198, 177, 83, 94],
      red_right: [193, 163, 79, 87],
      blue_left: [193, 163, 79, 76],
      blue_right: [198, 177, 83, 83],
    })
    for (const art of allProductTsuppariArts()) {
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(origin.y * art.height).toBeCloseTo(art.pivot.y, 9)
      expect(art.bodyCoreDiameterPx).toBe(123.076923)
      expect(art.bodyCoreDiameterPx).toBe(PRODUCT_WRESTLER_ART[art.id].bodyCoreDiameterPx)
    }
  })

  it('hand mapping: blue left = reflected red right, blue right = reflected red left', () => {
    const reflected = (a: { width: number; height: number; pivot: { x: number; y: number } }) => ({
      width: a.width,
      height: a.height,
      pivot: { x: a.pivot.x, y: a.height - a.pivot.y },
    })
    const geometry = (a: { width: number; height: number; pivot: { x: number; y: number } }) => ({ width: a.width, height: a.height, pivot: a.pivot })
    expect(geometry(PRODUCT_TSUPPARI_ART.blue.left)).toEqual(reflected(PRODUCT_TSUPPARI_ART.red.right))
    expect(geometry(PRODUCT_TSUPPARI_ART.blue.right)).toEqual(reflected(PRODUCT_TSUPPARI_ART.red.left))
  })

  for (const hand of ['left', 'right'] as const) {
    it(`holds the ${hand} pose for the whole Tsuppari action, then returns to the idle sprite`, () => {
      const sim = newSim()
      const { red, blue } = PRODUCT_WRESTLER_ART
      expect(selectWrestlerArt(red, visualOf(sim.getSnapshot()))).toBe(red)
      sim.step(intents(hand === 'left', hand === 'right'))
      const phases = new Set<string>()
      let held = 0
      while (visualOf(sim.getSnapshot()).pose === 'tsuppari' && held < 100) {
        const visual = visualOf(sim.getSnapshot())
        held++
        phases.add(visual.tsuppariPhase ?? '')
        expect(selectWrestlerArt(red, visual)).toBe(PRODUCT_TSUPPARI_ART.red[hand])
        expect(selectWrestlerArt(blue, visual)).toBe(PRODUCT_TSUPPARI_ART.blue[hand])
        sim.step(intents())
      }
      // the pose is shown on every Snapshot of the action (the press tick itself already advanced one tick)
      expect(held).toBe(TSUPPARI_STARTUP_TICKS + TSUPPARI_ACTIVE_TICKS + TSUPPARI_RECOVERY_TICKS - 1)
      expect([...phases].sort()).toEqual(['active', 'recovery', 'startup'])
      const after = visualOf(sim.getSnapshot())
      expect(after.pose).not.toBe('tsuppari')
      expect(selectWrestlerArt(red, after)).toBe(red)
      expect(selectWrestlerArt(blue, after)).toBe(blue)
    })
  }

  it('non-Tsuppari poses (idle / move) use the accepted idle sprite', () => {
    const sim = newSim()
    const s = sim.getSnapshot()
    for (const moving of [false, true]) {
      const visual = resolveWrestlerVisualState(s.participants[0], s.participants[1], s.engagement, s.outcome, moving)
      expect(visual.pose).not.toBe('tsuppari')
      expect(selectWrestlerArt(PRODUCT_WRESTLER_ART.blue, visual)).toBe(PRODUCT_WRESTLER_ART.blue)
    }
  })

  it('selection is presentation only: the Snapshot is unchanged', () => {
    const sim = newSim()
    sim.step(intents(false, true))
    const before = JSON.stringify(sim.getSnapshot())
    expect(selectWrestlerArt(PRODUCT_WRESTLER_ART.blue, visualOf(sim.getSnapshot())).assetPath).toContain('/blue_right.png')
    expect(JSON.stringify(sim.getSnapshot())).toBe(before)
  })

  it('no Visual-Gate art mode remains (module exports, scene key 4, debug label, gate assets)', () => {
    expect(Object.keys(productTsuppari).sort()).toEqual([
      'PRODUCT_TSUPPARI_ART',
      'PRODUCT_TSUPPARI_BODY_CORE_DIAMETER_PX',
      'allProductTsuppariArts',
      'selectWrestlerArt',
    ])
    expect(selectWrestlerArt.length).toBe(2)
    for (const source of [artSource, sceneSource, viewSource]) {
      expect(source).not.toMatch(/TsuppariArtMode|tsuppariArtMode|tsuppari-gate|tsuppariGateArt|TSU ART|mirror[-_](l|r)\b|MIRROR-[LR]/i)
    }
    expect(sceneSource).not.toMatch(/KeyCodes\.FOUR/)
    expect(sceneSource).not.toMatch(/4 tsu art/)
  })

  it('stays Phaser-free and Simulation-free', () => {
    expect(artSource).not.toMatch(/from ['"]phaser['"]/)
    expect(artSource).not.toMatch(/BoutSimulation/)
  })
})
