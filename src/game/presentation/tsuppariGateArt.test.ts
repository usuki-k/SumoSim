import { describe, expect, it } from 'vitest'
import { BODY_RADIUS, BoutSimulation, TSUPPARI_ACTIVE_TICKS, TSUPPARI_RECOVERY_TICKS, TSUPPARI_STARTUP_TICKS } from '../sumo/BoutSimulation.ts'
import type { BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin } from './productWrestlerArt.ts'
import {
  TSUPPARI_ART_MODES,
  TSUPPARI_ART_MODE_LABEL,
  allTsuppariGateArts,
  nextTsuppariArtMode,
  selectWrestlerArt,
  tsuppariGateArt,
  type TsuppariArtMode,
} from './tsuppariGateArt.ts'
import gateSource from './tsuppariGateArt.ts?raw'
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

describe('Tsuppari art Visual Gate (ACTION-07C)', () => {
  it('key 4 cycles SEPARATE -> MIRROR-L -> MIRROR-R -> SEPARATE', () => {
    expect(TSUPPARI_ART_MODES.map((m) => TSUPPARI_ART_MODE_LABEL[m])).toEqual(['SEPARATE', 'MIRROR-L', 'MIRROR-R'])
    let mode: TsuppariArtMode = 'separate'
    const seen: TsuppariArtMode[] = [mode]
    for (let i = 0; i < 3; i++) seen.push((mode = nextTsuppariArtMode(mode)))
    expect(seen).toEqual(['separate', 'mirror-left', 'mirror-right', 'separate'])
  })

  it('12 distinct textures under tsuppari-gate/, none overwrites the idle sprites', () => {
    const arts = allTsuppariGateArts()
    expect(arts).toHaveLength(12)
    expect(new Set(arts.map((a) => a.textureKey)).size).toBe(12)
    const idle = Object.values(PRODUCT_WRESTLER_ART)
    for (const art of arts) {
      expect(art.assetPath).toMatch(/^assets\/action\/wrestler\/tsuppari-gate\/(separate|mirror_l|mirror_r)_(red|blue)_(left|right)\.png$/)
      expect(idle.map((i) => i.assetPath)).not.toContain(art.assetPath)
      expect(idle.map((i) => i.textureKey)).not.toContain(art.textureKey)
    }
  })

  it('each texture keeps its own pivot inside it and the idle body-core scale', () => {
    for (const art of allTsuppariGateArts()) {
      expect(art.pivot.x).toBeGreaterThan(0)
      expect(art.pivot.x).toBeLessThan(art.width)
      expect(art.pivot.y).toBeGreaterThan(0)
      expect(art.pivot.y).toBeLessThan(art.height)
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(art.bodyCoreDiameterPx).toBe(PRODUCT_WRESTLER_ART[art.id].bodyCoreDiameterPx)
    }
  })

  it('hand mapping: reflection swaps the hand, so the same source appears across colours with opposite hands', () => {
    const geometry = (mode: TsuppariArtMode, id: 'red' | 'blue', hand: 'left' | 'right') => {
      const { width, height, pivot } = tsuppariGateArt(mode, id, hand)
      return { width, height, pivot }
    }
    const reflected = (g: ReturnType<typeof geometry>) => ({ ...g, pivot: { x: g.pivot.x, y: g.height - g.pivot.y } })
    // separate: blue L = reflected red R, blue R = reflected red L
    expect(geometry('separate', 'blue', 'left')).toEqual(reflected(geometry('separate', 'red', 'right')))
    expect(geometry('separate', 'blue', 'right')).toEqual(reflected(geometry('separate', 'red', 'left')))
    // mirror-left: everything from red L (red R / blue R reflected, blue L unreflected)
    expect(geometry('mirror-left', 'red', 'right')).toEqual(reflected(geometry('separate', 'red', 'left')))
    expect(geometry('mirror-left', 'blue', 'left')).toEqual(geometry('separate', 'red', 'left'))
    expect(geometry('mirror-left', 'blue', 'right')).toEqual(reflected(geometry('separate', 'red', 'left')))
    // mirror-right: everything from red R
    expect(geometry('mirror-right', 'red', 'left')).toEqual(reflected(geometry('separate', 'red', 'right')))
    expect(geometry('mirror-right', 'blue', 'right')).toEqual(geometry('separate', 'red', 'right'))
    expect(geometry('mirror-right', 'blue', 'left')).toEqual(reflected(geometry('separate', 'red', 'right')))
  })

  it('selects the held pose for the whole Tsuppari action and the idle sprite otherwise', () => {
    const sim = newSim()
    const idleRed = PRODUCT_WRESTLER_ART.red
    expect(selectWrestlerArt(idleRed, visualOf(sim.getSnapshot()), 'separate')).toBe(idleRed)
    sim.step(intents(true, false))
    const phases = new Set<string>()
    let held = 0
    while (visualOf(sim.getSnapshot()).pose === 'tsuppari' && held < 100) {
      const visual = visualOf(sim.getSnapshot())
      held++
      phases.add(visual.tsuppariPhase ?? '')
      for (const mode of TSUPPARI_ART_MODES) {
        expect(selectWrestlerArt(idleRed, visual, mode)).toEqual(tsuppariGateArt(mode, 'red', 'left'))
        expect(selectWrestlerArt(PRODUCT_WRESTLER_ART.blue, visual, mode)).toEqual(tsuppariGateArt(mode, 'blue', 'left'))
      }
      sim.step(intents())
    }
    // the pose is shown on every Snapshot of the action (the press tick itself already advanced one tick)
    expect(held).toBe(TSUPPARI_STARTUP_TICKS + TSUPPARI_ACTIVE_TICKS + TSUPPARI_RECOVERY_TICKS - 1)
    expect([...phases].sort()).toEqual(['active', 'recovery', 'startup'])
    expect(visualOf(sim.getSnapshot()).pose).not.toBe('tsuppari')
    expect(selectWrestlerArt(idleRed, visualOf(sim.getSnapshot()), 'mirror-right')).toBe(idleRed)
  })

  it('the art mode is presentation only: selecting textures leaves the Snapshot unchanged', () => {
    const sim = newSim()
    sim.step(intents(false, true))
    const before = JSON.stringify(sim.getSnapshot())
    for (const mode of TSUPPARI_ART_MODES) {
      expect(selectWrestlerArt(PRODUCT_WRESTLER_ART.blue, visualOf(sim.getSnapshot()), mode).assetPath).toContain('_blue_right')
    }
    expect(JSON.stringify(sim.getSnapshot())).toBe(before)
  })

  it('stays Phaser-free and Simulation-free', () => {
    expect(gateSource).not.toMatch(/from ['"]phaser['"]/)
    expect(gateSource).not.toMatch(/BoutSimulation/)
  })
})
