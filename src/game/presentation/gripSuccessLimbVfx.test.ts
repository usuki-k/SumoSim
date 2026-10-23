import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_RECOVERY_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import {
  GRIP_SUCCESS_FORWARD_OFFSET_R,
  GRIP_SUCCESS_LATERAL_OFFSET_R,
  gripSuccessDisplayOffsetPx,
} from './gripSuccessGateArt.ts'
import {
  GRIP_SUCCESS_LIMBS,
  gripSuccessLimbPlacement,
  gripSuccessLimbsVisible,
  type GripSuccessLimb,
} from './gripSuccessLimbVfx.ts'
import limbSource from './gripSuccessLimbVfx.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import { resolveWrestlerVisualState } from './wrestlerVisualState.ts'

type Input = { counter?: boolean; left?: boolean; push?: boolean; grip?: boolean; drive?: boolean; move?: [number, number] }
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
const visibleOf = (s: BoutSnapshot, who: 0 | 1) => gripSuccessLimbsVisible(visualOf(s, who))

function neutralGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
  return sim
}

function morozashiGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) sim.step(intents({}, { counter: t === 0 }))
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  return sim
}

const limbOf = (layer: 'far' | 'near'): GripSuccessLimb => GRIP_SUCCESS_LIMBS.find((l) => l.layer === layer)!
const R_PX = 40
const CENTER = { x: 300, y: 200 }

describe('Grip success arm / hand VFX (ACTION-11G)', () => {
  it('one FAR and one NEAR limb with the reported R-relative geometry', () => {
    expect(GRIP_SUCCESS_LIMBS.map((l) => l.layer)).toEqual(['far', 'near'])
    expect(limbOf('far')).toEqual({
      layer: 'far', startForwardR: 0.18, startLateralR: 0.42, endForwardR: 0.82, endLateralR: 0.25, widthR: 0.2, handRadiusR: 0.15,
    })
    expect(limbOf('near')).toEqual({
      layer: 'near', startForwardR: 0.22, startLateralR: -0.65, endForwardR: 1.12, endLateralR: -0.58, widthR: 0.22, handRadiusR: 0.16,
    })
  })

  it('G1-G3: hidden on non-success poses, visible for grapple and drive', () => {
    const s = neutralGrapple().getSnapshot()
    const v = visualOf(s, 0)
    expect(v.pose).toBe('grapple')
    expect(gripSuccessLimbsVisible(v)).toBe(true) // G2
    expect(gripSuccessLimbsVisible({ ...v, pose: 'drive' })).toBe(true) // G3
    for (const pose of ['idle', 'move', 'push', 'tsuppari', 'counter', 'kuzushi', 'grip'] as const) {
      expect(gripSuccessLimbsVisible({ ...v, pose })).toBe(false) // G1
    }
  })

  it('G4: facing 0 maps local forward to +x and wrestler RIGHT to +y', () => {
    const p = gripSuccessLimbPlacement(limbOf('near'), CENTER, 0, R_PX)
    expect(p.start.x).toBeCloseTo(CENTER.x + 0.22 * R_PX, 9)
    expect(p.start.y).toBeCloseTo(CENTER.y - 0.65 * R_PX, 9)
    expect(p.end.x).toBeCloseTo(CENTER.x + 1.12 * R_PX, 9)
    expect(p.end.y).toBeCloseTo(CENTER.y - 0.58 * R_PX, 9)
    expect(p.angle).toBeCloseTo(Math.atan2(0.07, 0.9), 9)
  })

  it('G5: facing pi/2, pi and -pi/2 rotate the limb rigidly about the displayed center', () => {
    const limb = limbOf('near')
    const expected = (f: number, fw: number, lat: number) => ({
      x: CENTER.x + fw * R_PX * Math.cos(f) - lat * R_PX * Math.sin(f),
      y: CENTER.y + fw * R_PX * Math.sin(f) + lat * R_PX * Math.cos(f),
    })
    const base = gripSuccessLimbPlacement(limb, CENTER, 0, R_PX)
    for (const f of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p = gripSuccessLimbPlacement(limb, CENTER, f, R_PX)
      const s = expected(f, limb.startForwardR, limb.startLateralR)
      const e = expected(f, limb.endForwardR, limb.endLateralR)
      expect(p.start.x).toBeCloseTo(s.x, 9)
      expect(p.start.y).toBeCloseTo(s.y, 9)
      expect(p.end.x).toBeCloseTo(e.x, 9)
      expect(p.end.y).toBeCloseTo(e.y, 9)
      expect(p.lengthPx).toBeCloseTo(base.lengthPx, 9)
      const turn = Math.atan2(Math.sin(p.angle - base.angle - f), Math.cos(p.angle - base.angle - f))
      expect(Math.abs(turn)).toBeLessThan(1e-9)
    }
    // pi/2 explicitly: forward -> +y, RIGHT -> -x
    const q = gripSuccessLimbPlacement(limb, CENTER, Math.PI / 2, R_PX)
    expect(q.end.x).toBeCloseTo(CENTER.x + 0.58 * R_PX, 9)
    expect(q.end.y).toBeCloseTo(CENTER.y + 1.12 * R_PX, 9)
  })

  it('G6: length, width and hand size scale with R', () => {
    for (const limb of GRIP_SUCCESS_LIMBS) {
      for (const r of [20, 40, 61.5]) {
        const p = gripSuccessLimbPlacement(limb, CENTER, 0.3, r)
        const len = Math.hypot(limb.endForwardR - limb.startForwardR, limb.endLateralR - limb.startLateralR)
        expect(p.lengthPx).toBeCloseTo(len * r, 9)
        expect(p.widthPx).toBeCloseTo(limb.widthR * r, 9)
        expect(p.handRadiusPx).toBeCloseTo(limb.handRadiusR * r, 9)
      }
    }
  })

  it('G7: near and far arms stay on opposite lateral sides (near = LEFT, far = RIGHT); both reach forward', () => {
    const near = limbOf('near')
    const far = limbOf('far')
    for (const l of [near.startLateralR, near.endLateralR]) expect(l).toBeLessThan(0)
    for (const l of [far.startLateralR, far.endLateralR]) expect(l).toBeGreaterThan(0)
    for (const limb of GRIP_SUCCESS_LIMBS) expect(limb.endForwardR).toBeGreaterThan(limb.startForwardR)
  })

  it('G8: deterministic', () => {
    for (const limb of GRIP_SUCCESS_LIMBS) {
      expect(gripSuccessLimbPlacement(limb, CENTER, 1.234, R_PX)).toEqual(gripSuccessLimbPlacement(limb, CENTER, 1.234, R_PX))
    }
  })

  it('S1-S4: neutral, Morozashi holder / disadvantaged and Drive show the limbs for both wrestlers', () => {
    const n = neutralGrapple()
    expect(visibleOf(n.getSnapshot(), 0) && visibleOf(n.getSnapshot(), 1)).toBe(true) // S1
    const m = morozashiGrapple().getSnapshot()
    expect(visualOf(m, 0).grappleRole).toBe('morozashi-holder')
    expect(visualOf(m, 1).grappleRole).toBe('morozashi-disadvantaged')
    expect(visibleOf(m, 0)).toBe(true) // S2
    expect(visibleOf(m, 1)).toBe(true) // S3
    const poses = new Set<string>()
    for (let k = 0; k < 40; k++) {
      n.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
      const s = n.getSnapshot()
      poses.add(visualOf(s, 0).pose)
      expect(visibleOf(s, 0) && visibleOf(s, 1)).toBe(true) // S4: no hide / show flicker
    }
    expect(poses).toContain('drive')
  })

  it('S5 / S6: hidden through the Grip attempt and on the release tick + recovery', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }))
    while (sim.getSnapshot().engagement.kind === 'free') {
      expect(visibleOf(sim.getSnapshot(), 0) || visibleOf(sim.getSnapshot(), 1)).toBe(false) // S5
      sim.step(intents())
    }
    expect(visibleOf(sim.getSnapshot(), 0)).toBe(true)
    sim.step(intents({ grip: true })) // release
    for (let k = 0; k <= GRIP_RECOVERY_TICKS; k++) {
      const s = sim.getSnapshot()
      expect(s.engagement.kind).toBe('free')
      expect(visibleOf(s, 0) || visibleOf(s, 1)).toBe(false) // S6
      sim.step(intents())
    }
  })

  it('S7: hidden for idle, Push, Tsuppari, Counter and Kuzushi', () => {
    const sim = newSim(FAR)
    const seen = new Set<string>()
    const steps: Input[] = [{}, { left: true }, ...Array(40).fill({}), { counter: true }, ...Array(120).fill({}), { push: true }, ...Array(60).fill({})]
    for (const step of steps) {
      sim.step(intents(step))
      const v = visualOf(sim.getSnapshot())
      seen.add(v.pose)
      expect(gripSuccessLimbsVisible(v)).toBe(false)
    }
    expect([...seen]).toEqual(expect.arrayContaining(['idle', 'tsuppari', 'counter', 'kuzushi', 'push']))
  })

  it('anchored to the displayed (ACTION-11F offset) center: the shoulder sits where the offset body puts it', () => {
    const s = neutralGrapple().getSnapshot()
    const v = visualOf(s, 0)
    const facing = s.participants[0].facing
    const canonical = { x: 100, y: 100 }
    const display = gripSuccessDisplayOffsetPx(v, facing, R_PX)
    const p = gripSuccessLimbPlacement(limbOf('near'), { x: canonical.x + display.x, y: canonical.y + display.y }, facing, R_PX)
    const fw = 0.22 + GRIP_SUCCESS_FORWARD_OFFSET_R
    const lat = -0.65 + GRIP_SUCCESS_LATERAL_OFFSET_R
    expect(p.start.x).toBeCloseTo(canonical.x + fw * R_PX * Math.cos(facing) - lat * R_PX * Math.sin(facing), 9)
    expect(p.start.y).toBeCloseTo(canonical.y + fw * R_PX * Math.sin(facing) + lat * R_PX * Math.cos(facing), 9)
  })

  it('O1-O3: Snapshot unchanged, bond 0.70 m, ACTION-11F constants unchanged', () => {
    const sim = neutralGrapple()
    const before = JSON.stringify(sim.getSnapshot())
    for (const who of [0, 1] as const) {
      gripSuccessLimbsVisible(visualOf(sim.getSnapshot(), who))
      for (const limb of GRIP_SUCCESS_LIMBS) gripSuccessLimbPlacement(limb, CENTER, sim.getSnapshot().participants[who].facing, R_PX)
    }
    const s = sim.getSnapshot()
    expect(JSON.stringify(s)).toBe(before)
    const [a, b] = s.participants
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeCloseTo(COMBINED, 9)
    expect(GRIP_SUCCESS_FORWARD_OFFSET_R).toBe(0.14)
    expect(GRIP_SUCCESS_LATERAL_OFFSET_R).toBe(-0.2)
  })

  it('Phaser-free and Simulation-free; WrestlerView layers FAR below / NEAR above the bodies from the displayed center', () => {
    expect(limbSource).not.toMatch(/from ['"]phaser['"]/)
    expect(limbSource).not.toMatch(/BoutSimulation/)
    expect(viewSource).toMatch(/GRIP_LIMB_DEPTH[^=]*= \{ far: 1\.9, near: 2\.2 \}/)
    expect(viewSource).toMatch(/WRESTLER_BODY_DEPTH = 2\b/)
    expect(viewSource).toMatch(/const center = \{ x: positionPx\.x \+ display\.x, y: positionPx\.y \+ display\.y \}/)
    expect(viewSource).toMatch(/gripSuccessLimbPlacement\(limb, center, participant\.facing, this\.R\)/)
  })
})
