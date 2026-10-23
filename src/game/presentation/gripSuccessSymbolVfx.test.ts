import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  GRIP_MIN_ATTEMPT_TICKS,
  GRIP_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
import {
  GRIP_SUCCESS_FORWARD_OFFSET_R,
  GRIP_SUCCESS_LATERAL_OFFSET_R,
  gripSuccessDisplayOffsetPx,
} from './gripSuccessGateArt.ts'
import {
  GRIP_SUCCESS_SYMBOL,
  gripSuccessPairSymbolVisible,
  gripSuccessSymbolLengthR,
  gripSuccessSymbolPlacement,
} from './gripSuccessSymbolVfx.ts'
import symbolSource from './gripSuccessSymbolVfx.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
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
const visibleOf = (s: BoutSnapshot, who: 0 | 1) =>
  gripSuccessPairSymbolVisible(visualOf(s, who), visualOf(s, (1 - who) as 0 | 1))

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

// A's Counter catches B's Push -> CounterTransition (A behind B) -> A Grips: Morozashi with B TURNING (rear grip).
function turningGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
  for (let t = 0; t < COUNTER_TRANSITION_TICKS; t++) sim.step(intents())
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  const s = sim.getSnapshot()
  expect(s.engagement.kind).toBe('grappled')
  expect(visualOf(s, 1).turning).toBe(true)
  return sim
}

const R_PX = 40
const CENTER = { x: 300, y: 200 }
const at = (center: { x: number; y: number }, f: number, fw: number, lat: number) => ({
  x: center.x + fw * R_PX * Math.cos(f) - lat * R_PX * Math.sin(f),
  y: center.y + fw * R_PX * Math.sin(f) + lat * R_PX * Math.cos(f),
})

describe('Grip success symbolic forearm + hand VFX (ACTION-11K)', () => {
  it('G1 / G6: one marker definition (elbow -> hand only, no shoulder / root), drawn once per wrestler view', () => {
    expect(GRIP_SUCCESS_SYMBOL).toEqual({
      elbowForwardR: -0.1,
      elbowLateralR: 0.95,
      handForwardR: -0.55,
      handLateralR: 0.6,
      widthR: 0.2,
      handRadiusR: 0.18,
      bend: 0.12,
    })
    expect(Object.keys(GRIP_SUCCESS_SYMBOL).some((k) => /shoulder|start|root|upper/i.test(k))).toBe(false)
    // exactly one marker image per WrestlerView -> two per pair; the old connected limbs are gone
    expect(viewSource.match(/scene\.add\s*\.image\(0, 0, symbolTexture\.key\)/g)?.length).toBe(1)
    expect(viewSource).not.toMatch(/gripSuccessLimb|GRIP_SUCCESS_LIMBS|GRIP_LIMB_DEPTH/)
  })

  it('G2: short forearm / hand sizes inside the Task ranges, scaled with R', () => {
    const len = gripSuccessSymbolLengthR(GRIP_SUCCESS_SYMBOL)
    expect(len).toBeGreaterThanOrEqual(0.35)
    expect(len).toBeLessThanOrEqual(0.6)
    expect(GRIP_SUCCESS_SYMBOL.widthR).toBeGreaterThanOrEqual(0.16)
    expect(GRIP_SUCCESS_SYMBOL.widthR).toBeLessThanOrEqual(0.22)
    expect(GRIP_SUCCESS_SYMBOL.handRadiusR).toBeGreaterThanOrEqual(0.15)
    expect(GRIP_SUCCESS_SYMBOL.handRadiusR).toBeLessThanOrEqual(0.2)
    for (const r of [20, 40, 61.5]) {
      const p = gripSuccessSymbolPlacement(CENTER, 0.4, r)
      expect(p.lengthPx).toBeCloseTo(len * r, 9)
      expect(p.widthPx).toBeCloseTo(0.2 * r, 9)
      expect(p.handRadiusPx).toBeCloseTo(0.18 * r, 9)
    }
  })

  it('G3: the hand lands on the back half of the target waist (mawashi side), inside its body', () => {
    const s = GRIP_SUCCESS_SYMBOL
    expect(s.handForwardR).toBeLessThanOrEqual(-0.35)
    expect(s.handForwardR).toBeGreaterThanOrEqual(-0.6)
    expect(Math.abs(s.handLateralR)).toBeGreaterThanOrEqual(0.55)
    expect(Math.abs(s.handLateralR)).toBeLessThanOrEqual(0.8)
    expect(Math.hypot(s.handForwardR, s.handLateralR)).toBeLessThan(0.9)
    // the forearm points into the hand from the target's flank (elbow nearer the outline, further forward)
    expect(Math.hypot(s.elbowForwardR, s.elbowLateralR)).toBeGreaterThan(Math.hypot(s.handForwardR, s.handLateralR))
    expect(s.elbowForwardR).toBeGreaterThan(s.handForwardR)
  })

  it('G4: rigid transform for facing 0, pi/2, pi, -pi/2 about the target displayed center', () => {
    const p0 = gripSuccessSymbolPlacement(CENTER, 0, R_PX)
    expect(p0.elbow.x).toBeCloseTo(CENTER.x - 0.1 * R_PX, 9)
    expect(p0.elbow.y).toBeCloseTo(CENTER.y + 0.95 * R_PX, 9)
    expect(p0.hand.x).toBeCloseTo(CENTER.x - 0.55 * R_PX, 9)
    expect(p0.hand.y).toBeCloseTo(CENTER.y + 0.6 * R_PX, 9)
    expect(p0.angle).toBeCloseTo(Math.atan2(-0.35, -0.45), 9)
    for (const f of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p = gripSuccessSymbolPlacement(CENTER, f, R_PX)
      const elbow = at(CENTER, f, -0.1, 0.95)
      const hand = at(CENTER, f, -0.55, 0.6)
      expect(p.elbow.x).toBeCloseTo(elbow.x, 9)
      expect(p.elbow.y).toBeCloseTo(elbow.y, 9)
      expect(p.hand.x).toBeCloseTo(hand.x, 9)
      expect(p.hand.y).toBeCloseTo(hand.y, 9)
      expect(p.lengthPx).toBeCloseTo(p0.lengthPx, 9)
      const turn = Math.atan2(Math.sin(p.angle - p0.angle - f), Math.cos(p.angle - p0.angle - f))
      expect(Math.abs(turn)).toBeLessThan(1e-9)
    }
  })

  it('G5: a face-to-face pair gets two deterministic, complementary, non-coincident markers', () => {
    const s = neutralGrapple().getSnapshot()
    const centers = s.participants.map((p, i) => {
      const display = gripSuccessDisplayOffsetPx(visualOf(s, i as 0 | 1), p.facing, R_PX)
      return { x: 300 + p.position.x * R_PX / BODY_RADIUS + display.x, y: 200 + p.position.y * R_PX / BODY_RADIUS + display.y }
    })
    const [a, b] = s.participants.map((p, i) => gripSuccessSymbolPlacement(centers[i], p.facing, R_PX))
    expect(gripSuccessSymbolPlacement(centers[0], s.participants[0].facing, R_PX)).toEqual(a)
    expect(Math.hypot(a.hand.x - b.hand.x, a.hand.y - b.hand.y)).toBeGreaterThan(2 * R_PX)
    // point-symmetric about the displayed pair midpoint: opposite world sides of the pair axis
    const mid = { x: (centers[0].x + centers[1].x) / 2, y: (centers[0].y + centers[1].y) / 2 }
    expect(a.hand.x + b.hand.x - 2 * mid.x).toBeCloseTo(0, 9)
    expect(a.hand.y + b.hand.y - 2 * mid.y).toBeCloseTo(0, 9)
    expect(Math.sign(a.hand.y - mid.y)).toBe(-Math.sign(b.hand.y - mid.y))
  })

  it('anchored to the displayed (ACTION-11F offset) center of the target', () => {
    const s = neutralGrapple().getSnapshot()
    const facing = s.participants[0].facing
    const canonical = { x: 100, y: 100 }
    const display = gripSuccessDisplayOffsetPx(visualOf(s, 0), facing, R_PX)
    const p = gripSuccessSymbolPlacement({ x: canonical.x + display.x, y: canonical.y + display.y }, facing, R_PX)
    const expected = at(canonical, facing, -0.1 + GRIP_SUCCESS_FORWARD_OFFSET_R, 0.95 + GRIP_SUCCESS_LATERAL_OFFSET_R)
    expect(p.elbow.x).toBeCloseTo(expected.x, 9)
    expect(p.elbow.y).toBeCloseTo(expected.y, 9)
  })

  it('V1: READY neutral -> visible for both', () => {
    const s = neutralGrapple().getSnapshot()
    expect(visibleOf(s, 0) && visibleOf(s, 1)).toBe(true)
  })

  it('V2: READY Drive -> visible for both, no flicker', () => {
    const sim = neutralGrapple()
    const poses = new Set<string>()
    for (let k = 0; k < 40; k++) {
      sim.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
      const s = sim.getSnapshot()
      poses.add(visualOf(s, 0).pose)
      expect(visibleOf(s, 0) && visibleOf(s, 1)).toBe(true)
    }
    expect(poses).toContain('drive')
  })

  it('V3: READY Morozashi holder / disadvantaged -> visible for both', () => {
    const s = morozashiGrapple().getSnapshot()
    expect(visualOf(s, 0).grappleRole).toBe('morozashi-holder')
    expect(visualOf(s, 1).grappleRole).toBe('morozashi-disadvantaged')
    expect(visibleOf(s, 0) && visibleOf(s, 1)).toBe(true)
  })

  it('V4: either TURNING -> hidden for both; both appear on the same tick once READY', () => {
    const sim = turningGrapple()
    const v = visualOf(sim.getSnapshot(), 1)
    expect(gripSuccessPairSymbolVisible({ ...v, turning: true }, { ...v, turning: true })).toBe(false)
    let hidden = 0
    let shownAt = -1
    for (let k = 0; k < 400 && shownAt < 0; k++) {
      const s = sim.getSnapshot()
      expect(visibleOf(s, 0)).toBe(visibleOf(s, 1))
      if (visibleOf(s, 0)) shownAt = k
      else {
        expect(visualOf(s, 0).turning || visualOf(s, 1).turning).toBe(true)
        hidden++
      }
      sim.step(intents())
    }
    expect(hidden).toBeGreaterThan(0)
    expect(shownAt).toBeGreaterThan(0)
    for (let k = 0; k < 30; k++) {
      sim.step(intents())
      expect(visibleOf(sim.getSnapshot(), 0) && visibleOf(sim.getSnapshot(), 1)).toBe(true)
    }
  })

  it('V5 / V6: hidden through the Grip attempt, on the release tick and through recovery', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }))
    while (sim.getSnapshot().engagement.kind === 'free') {
      expect(visibleOf(sim.getSnapshot(), 0) || visibleOf(sim.getSnapshot(), 1)).toBe(false)
      sim.step(intents())
    }
    expect(visibleOf(sim.getSnapshot(), 0)).toBe(true)
    sim.step(intents({ grip: true })) // release
    for (let k = 0; k <= GRIP_RECOVERY_TICKS; k++) {
      expect(sim.getSnapshot().engagement.kind).toBe('free')
      expect(visibleOf(sim.getSnapshot(), 0) || visibleOf(sim.getSnapshot(), 1)).toBe(false)
      sim.step(intents())
    }
  })

  it('V7: hidden for idle, Push, Tsuppari, Counter and Kuzushi', () => {
    const sim = newSim(FAR)
    const seen = new Set<string>()
    const steps: Input[] = [{}, { left: true }, ...Array(40).fill({}), { counter: true }, ...Array(120).fill({}), { push: true }, ...Array(60).fill({})]
    for (const step of steps) {
      sim.step(intents(step))
      seen.add(visualOf(sim.getSnapshot()).pose)
      expect(visibleOf(sim.getSnapshot(), 0) || visibleOf(sim.getSnapshot(), 1)).toBe(false)
    }
    expect([...seen]).toEqual(expect.arrayContaining(['idle', 'tsuppari', 'counter', 'kuzushi', 'push']))
  })

  it('P1 / P3 / P4: Snapshot unchanged, bond 0.70 m, ACTION-11F constants unchanged', () => {
    const sim = neutralGrapple()
    const before = JSON.stringify(sim.getSnapshot())
    for (const who of [0, 1] as const) {
      visibleOf(sim.getSnapshot(), who)
      gripSuccessSymbolPlacement(CENTER, sim.getSnapshot().participants[who].facing, R_PX)
    }
    const s = sim.getSnapshot()
    expect(JSON.stringify(s)).toBe(before)
    const [a, b] = s.participants
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeCloseTo(COMBINED, 9)
    expect(GRIP_SUCCESS_FORWARD_OFFSET_R).toBe(0.14)
    expect(GRIP_SUCCESS_LATERAL_OFFSET_R).toBe(-0.2)
  })

  it('Phaser-free; WrestlerView draws it above both bodies from the displayed center with the pair rule', () => {
    expect(symbolSource).not.toMatch(/from ['"]phaser['"]/)
    expect(symbolSource).not.toMatch(/BoutSimulation/)
    expect(viewSource).toMatch(/GRIP_SYMBOL_DEPTH = 2\.3\b/)
    expect(viewSource).toMatch(/WRESTLER_BODY_DEPTH = 2\b/)
    expect(viewSource).toMatch(/WRESTLER_EFFECT_DEPTH = 2\.5\b/)
    expect(viewSource).toMatch(/const symbolVisible = gripSuccessPairSymbolVisible\(state, opponentState\)/)
    expect(viewSource).toMatch(/const center = \{ x: positionPx\.x \+ display\.x, y: positionPx\.y \+ display\.y \}/)
    expect(viewSource).toMatch(/gripSuccessSymbolPlacement\(center, participant\.facing, this\.R\)/)
    expect(sceneSource).toMatch(/view\.wrestler\.apply\(visual, participant, pos, opponentVisual\)/)
  })
})
