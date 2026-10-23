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
  GRIP_SUCCESS_LIMBS,
  gripSuccessPairLimbsVisible,
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
const pairVisibleOf = (s: BoutSnapshot, who: 0 | 1) => gripSuccessPairLimbsVisible(visualOf(s, who), visualOf(s, (1 - who) as 0 | 1))

function neutralGrapple(): BoutSimulation {
  const sim = newSim(COMBINED)
  sim.step(intents({ grip: true }))
  for (let k = 0; k < GRIP_MIN_ATTEMPT_TICKS; k++) sim.step(intents())
  expect(sim.getSnapshot().engagement).toEqual({ kind: 'grappled', advantage: { kind: 'neutral' } })
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
  expect(visualOf(s, 0).turning).toBe(false)
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

const segmentOf = (arm: 'high' | 'low', segment: 'upper' | 'forearm'): GripSuccessLimb =>
  GRIP_SUCCESS_LIMBS.find((l) => l.arm === arm && l.segment === segment)!
const R_PX = 40
const CENTER = { x: 300, y: 200 }
// Face to face with the ACTION-11F display offset: the opponent's displayed center in this wrestler's local frame
const OPP = { forward: 2 - 2 * GRIP_SUCCESS_FORWARD_OFFSET_R, lateral: -2 * GRIP_SUCCESS_LATERAL_OFFSET_R }
// a local point of this wrestler expressed in the opponent's local frame (the opponent faces back)
const inOpponent = (forward: number, lateral: number) => ({ forward: OPP.forward - forward, lateral: OPP.lateral - lateral })
const lengthOf = (l: GripSuccessLimb) => Math.hypot(l.endForwardR - l.startForwardR, l.endLateralR - l.startLateralR)

describe('Grip success arm / hand VFX (ACTION-11G, placement ACTION-11I)', () => {
  it('two wrapping arms, each an upper arm (FAR) + forearm with hand (NEAR), with the reported geometry', () => {
    expect(GRIP_SUCCESS_LIMBS.map((l) => `${l.arm}-${l.segment}-${l.layer}`)).toEqual([
      'low-upper-far',
      'low-forearm-near',
      'high-upper-far',
      'high-forearm-near',
    ])
    expect(
      GRIP_SUCCESS_LIMBS.map((l) => [l.startForwardR, l.startLateralR, l.endForwardR, l.endLateralR, l.widthR, l.handRadiusR]),
    ).toEqual([
      [0.35, 0.8, 1.55, 1.5, 0.26, 0],
      [1.55, 1.5, 2.2, 1.15, 0.26, 0.19],
      [0.35, -0.8, 1.25, -0.75, 0.24, 0],
      [1.25, -0.75, 1.6, -0.45, 0.24, 0.17],
    ])
    for (const arm of ['high', 'low'] as const) {
      const upper = segmentOf(arm, 'upper')
      const fore = segmentOf(arm, 'forearm')
      // the forearm starts exactly at the elbow with the same thickness; only the forearm has a hand
      expect([fore.startForwardR, fore.startLateralR]).toEqual([upper.endForwardR, upper.endLateralR])
      expect(fore.widthR).toBe(upper.widthR)
      expect(upper.handRadiusR).toBe(0)
      expect(fore.handRadiusR).toBeGreaterThan(fore.widthR / 2)
    }
  })

  it('V1-V3 (pure): hidden on non-success poses, visible for grapple and drive', () => {
    const s = neutralGrapple().getSnapshot()
    const v = visualOf(s, 0)
    expect(v.pose).toBe('grapple')
    expect(gripSuccessLimbsVisible(v)).toBe(true)
    expect(gripSuccessLimbsVisible({ ...v, pose: 'drive' })).toBe(true)
    for (const pose of ['idle', 'move', 'push', 'tsuppari', 'counter', 'kuzushi', 'grip'] as const) {
      expect(gripSuccessLimbsVisible({ ...v, pose })).toBe(false)
    }
  })

  it('G1: deterministic placement', () => {
    for (const limb of GRIP_SUCCESS_LIMBS) {
      expect(gripSuccessLimbPlacement(limb, CENTER, 1.234, R_PX)).toEqual(gripSuccessLimbPlacement(limb, CENTER, 1.234, R_PX))
    }
  })

  it('G2: each arm root (upper arm start) is inside the own body and drawn below the bodies', () => {
    for (const arm of ['high', 'low'] as const) {
      const upper = segmentOf(arm, 'upper')
      expect(Math.hypot(upper.startForwardR, upper.startLateralR)).toBeLessThan(0.95)
      expect(upper.layer).toBe('far')
    }
  })

  it('G3: hands land across on the opponent body; elbows sit on its outline (the arm wraps around it)', () => {
    for (const arm of ['high', 'low'] as const) {
      const fore = segmentOf(arm, 'forearm')
      expect(fore.layer).toBe('near')
      expect(fore.endForwardR).toBeGreaterThan(1.2)
      const hand = inOpponent(fore.endForwardR, fore.endLateralR)
      expect(Math.hypot(hand.forward, hand.lateral)).toBeLessThan(0.95)
      const elbow = inOpponent(fore.startForwardR, fore.startLateralR)
      expect(Math.hypot(elbow.forward, elbow.lateral)).toBeGreaterThan(1.0)
      expect(Math.hypot(elbow.forward, elbow.lateral)).toBeLessThan(1.3)
    }
  })

  it('G4 / G5: HIGH hand on the opponent upper torso (front half), LOW hand at its waist / mawashi (back half)', () => {
    const high = segmentOf('high', 'forearm')
    const low = segmentOf('low', 'forearm')
    expect(inOpponent(high.endForwardR, high.endLateralR).forward).toBeGreaterThan(0)
    expect(inOpponent(low.endForwardR, low.endLateralR).forward).toBeLessThan(0)
    // HIGH on the wrestler LEFT, LOW on the RIGHT; the LOW forearm is the longer visible one
    for (const l of GRIP_SUCCESS_LIMBS.filter((x) => x.arm === 'high')) {
      expect(Math.max(l.startLateralR, l.endLateralR)).toBeLessThan(0)
    }
    for (const l of GRIP_SUCCESS_LIMBS.filter((x) => x.arm === 'low')) {
      expect(Math.min(l.startLateralR, l.endLateralR)).toBeGreaterThan(0)
    }
    expect(lengthOf(low)).toBeGreaterThan(lengthOf(high))
  })

  it('facing 0 maps local forward to +x and wrestler RIGHT to +y; pi/2, pi, -pi/2 rotate rigidly', () => {
    const limb = segmentOf('low', 'forearm')
    const p0 = gripSuccessLimbPlacement(limb, CENTER, 0, R_PX)
    expect(p0.start.x).toBeCloseTo(CENTER.x + 1.55 * R_PX, 9)
    expect(p0.start.y).toBeCloseTo(CENTER.y + 1.5 * R_PX, 9)
    expect(p0.end.x).toBeCloseTo(CENTER.x + 2.2 * R_PX, 9)
    expect(p0.end.y).toBeCloseTo(CENTER.y + 1.15 * R_PX, 9)
    expect(p0.angle).toBeCloseTo(Math.atan2(-0.35, 0.65), 9)
    for (const f of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const p = gripSuccessLimbPlacement(limb, CENTER, f, R_PX)
      const at = (fw: number, lat: number) => ({
        x: CENTER.x + fw * R_PX * Math.cos(f) - lat * R_PX * Math.sin(f),
        y: CENTER.y + fw * R_PX * Math.sin(f) + lat * R_PX * Math.cos(f),
      })
      expect(p.start.x).toBeCloseTo(at(1.55, 1.5).x, 9)
      expect(p.start.y).toBeCloseTo(at(1.55, 1.5).y, 9)
      expect(p.end.x).toBeCloseTo(at(2.2, 1.15).x, 9)
      expect(p.end.y).toBeCloseTo(at(2.2, 1.15).y, 9)
      expect(p.lengthPx).toBeCloseTo(p0.lengthPx, 9)
      const turn = Math.atan2(Math.sin(p.angle - p0.angle - f), Math.cos(p.angle - p0.angle - f))
      expect(Math.abs(turn)).toBeLessThan(1e-9)
    }
  })

  it('G6: length, width and hand size scale with R', () => {
    for (const limb of GRIP_SUCCESS_LIMBS) {
      for (const r of [20, 40, 61.5]) {
        const p = gripSuccessLimbPlacement(limb, CENTER, 0.3, r)
        expect(p.lengthPx).toBeCloseTo(lengthOf(limb) * r, 9)
        expect(p.widthPx).toBeCloseTo(limb.widthR * r, 9)
        expect(p.handRadiusPx).toBeCloseTo(limb.handRadiusR * r, 9)
      }
    }
  })

  it('V1 / V2: neutral, Morozashi holder / disadvantaged and Drive show the limbs for both wrestlers', () => {
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

  it('V3 / V4: hidden through the Grip attempt and on the release tick + recovery', () => {
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

  it('V5: hidden for idle, Push, Tsuppari, Counter and Kuzushi', () => {
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
    const p = gripSuccessLimbPlacement(segmentOf('low', 'upper'), { x: canonical.x + display.x, y: canonical.y + display.y }, facing, R_PX)
    const fw = 0.35 + GRIP_SUCCESS_FORWARD_OFFSET_R
    const lat = 0.8 + GRIP_SUCCESS_LATERAL_OFFSET_R
    expect(p.start.x).toBeCloseTo(canonical.x + fw * R_PX * Math.cos(facing) - lat * R_PX * Math.sin(facing), 9)
    expect(p.start.y).toBeCloseTo(canonical.y + fw * R_PX * Math.sin(facing) + lat * R_PX * Math.cos(facing), 9)
  })

  describe('pair READY visibility (ACTION-11J)', () => {
    it('V1: both grappled and READY -> visible for both', () => {
      const s = neutralGrapple().getSnapshot()
      expect(visualOf(s, 0).turning || visualOf(s, 1).turning).toBe(false)
      expect(pairVisibleOf(s, 0)).toBe(true)
      expect(pairVisibleOf(s, 1)).toBe(true)
    })

    it('V2 / V3: one wrestler TURNING -> hidden for both (the turning one and its READY opponent)', () => {
      const s = turningGrapple().getSnapshot()
      expect(visibleOf(s, 0) && visibleOf(s, 1)).toBe(true) // the success pose itself is shown
      expect(pairVisibleOf(s, 1)).toBe(false) // V2: self TURNING
      expect(pairVisibleOf(s, 0)).toBe(false) // V3: opponent TURNING
    })

    it('V4: both TURNING -> hidden', () => {
      const v = visualOf(turningGrapple().getSnapshot(), 1)
      expect(gripSuccessPairLimbsVisible({ ...v, turning: true }, { ...v, turning: true })).toBe(false)
    })

    it('V5: TURNING -> READY shows both wrestlers on the same tick, and never one without the other', () => {
      const sim = turningGrapple()
      let turningTicks = 0
      let shownAt = -1
      for (let k = 0; k < 400 && shownAt < 0; k++) {
        const s = sim.getSnapshot()
        expect(pairVisibleOf(s, 0)).toBe(pairVisibleOf(s, 1))
        if (pairVisibleOf(s, 0)) shownAt = k
        else {
          expect(visualOf(s, 0).turning || visualOf(s, 1).turning).toBe(true)
          turningTicks++
        }
        sim.step(intents())
      }
      expect(turningTicks).toBeGreaterThan(0)
      expect(shownAt).toBeGreaterThan(0)
      for (let k = 0; k < 30; k++) {
        sim.step(intents())
        const s = sim.getSnapshot()
        expect(pairVisibleOf(s, 0) && pairVisibleOf(s, 1)).toBe(true) // no flicker once settled
      }
    })

    it('V6 / V7: Drive and Morozashi with both READY -> visible', () => {
      const n = neutralGrapple()
      const poses = new Set<string>()
      for (let k = 0; k < 40; k++) {
        n.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
        const s = n.getSnapshot()
        poses.add(visualOf(s, 0).pose)
        expect(pairVisibleOf(s, 0) && pairVisibleOf(s, 1)).toBe(true)
      }
      expect(poses).toContain('drive')
      const m = morozashiGrapple().getSnapshot()
      expect(visualOf(m, 0).turning || visualOf(m, 1).turning).toBe(false)
      expect(pairVisibleOf(m, 0) && pairVisibleOf(m, 1)).toBe(true)
    })

    it('V8: Grip attempt / recovery / other actions -> hidden', () => {
      const sim = newSim(COMBINED)
      sim.step(intents({ grip: true }))
      while (sim.getSnapshot().engagement.kind === 'free') {
        expect(pairVisibleOf(sim.getSnapshot(), 0) || pairVisibleOf(sim.getSnapshot(), 1)).toBe(false)
        sim.step(intents())
      }
      sim.step(intents({ grip: true })) // release
      for (let k = 0; k <= GRIP_RECOVERY_TICKS; k++) {
        expect(pairVisibleOf(sim.getSnapshot(), 0) || pairVisibleOf(sim.getSnapshot(), 1)).toBe(false)
        sim.step(intents())
      }
      const free = newSim(FAR)
      const steps: Input[] = [{ left: true }, ...Array(40).fill({}), { counter: true }, ...Array(120).fill({}), { push: true }]
      for (const step of steps) {
        free.step(intents(step))
        expect(pairVisibleOf(free.getSnapshot(), 0)).toBe(false)
      }
    })
  })

  it('P1 / P4 / P5: Snapshot unchanged, bond 0.70 m, ACTION-11F constants unchanged', () => {
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
    expect(viewSource).toMatch(/const limbsVisible = gripSuccessPairLimbsVisible\(state, opponentState\)/)
  })
})
