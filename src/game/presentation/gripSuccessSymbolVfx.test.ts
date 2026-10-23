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
  allGripSuccessGateArts,
  gripSuccessDisplayOffsetPx,
} from './gripSuccessGateArt.ts'
import {
  GRIP_MARKER_ART,
  GRIP_SUCCESS_MARKERS,
  allGripMarkerArts,
  gripMarkerLengthR,
  gripMarkerPlacement,
  gripMarkerWaistAngleDeg,
  gripSuccessPairSymbolVisible,
} from './gripSuccessSymbolVfx.ts'
import symbolSource from './gripSuccessSymbolVfx.ts?raw'
import viewSource from '../scenes/WrestlerView.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
import { allGripAttemptGateArts } from './gripAttemptGateArt.ts'
import { allProductCounterArts } from './productCounterArt.ts'
import { allProductTsuppariArts } from './productTsuppariArt.ts'
import { PRODUCT_WRESTLER_ART } from './productWrestlerArt.ts'
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
// markers shown for the whole pair: each view draws its own two when the pair rule holds
// participant a is drawn with the blue art and b with the red art (as in BoutScene, wrestler-a -> blue)
const ART_OF = ['blue', 'red'] as const
const shownCount = (s: BoutSnapshot) =>
  ([0, 1] as const).reduce<number>((n, who) => n + (visibleOf(s, who) ? GRIP_SUCCESS_MARKERS[ART_OF[who]].length : 0), 0)
const ALL_MARKERS = [...GRIP_SUCCESS_MARKERS.red, ...GRIP_SUCCESS_MARKERS.blue]

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
const roleOf = (art: 'red' | 'blue', role: 'headSide' | 'footSide') => GRIP_SUCCESS_MARKERS[art].find((m) => m.role === role)!

describe('Grip success authored hand markers (ACTION-11L; lower markers ACTION-11M / 11N)', () => {
  it('runtime art: the authored texture + its offline mirror, anchors inside, distinct from every other texture', () => {
    expect(allGripMarkerArts().map((a) => a.assetPath)).toEqual([
      'assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png',
      'assets/action/wrestler/grip-symbol-authored-gate/forearm_hand_mirrored.png',
    ])
    const { authored, mirrored } = GRIP_MARKER_ART
    expect([mirrored.width, mirrored.height]).toEqual([authored.width, authored.height])
    expect(mirrored.hand).toEqual({ x: authored.hand.x, y: authored.height - authored.hand.y })
    expect(mirrored.elbow).toEqual({ x: authored.elbow.x, y: authored.height - authored.elbow.y })
    for (const art of allGripMarkerArts()) {
      for (const p of [art.hand, art.elbow]) {
        expect(p.x).toBeGreaterThan(0)
        expect(p.x).toBeLessThan(art.width)
        expect(p.y).toBeGreaterThan(0)
        expect(p.y).toBeLessThan(art.height)
      }
    }
    const others = [
      ...Object.values(PRODUCT_WRESTLER_ART),
      ...allProductTsuppariArts(),
      ...allProductCounterArts(),
      ...allGripAttemptGateArts(),
      ...allGripSuccessGateArts(),
    ]
    for (const art of allGripMarkerArts()) {
      expect(others.map((o) => o.textureKey)).not.toContain(art.textureKey)
      expect(others.map((o) => o.assetPath)).not.toContain(art.assetPath)
    }
    expect(viewSource).toMatch(/\.\.\.allGripMarkerArts\(\)/) // preloaded with the wrestler art
  })

  it('G1 / G2: two markers per target wrestler (head side + foot side) -> four per READY pair', () => {
    expect(GRIP_SUCCESS_MARKERS.red.map((m) => `${m.role}:${m.side}:${m.art}`)).toEqual([
      'headSide:right:authored',
      'footSide:left:mirrored',
    ])
    expect(GRIP_SUCCESS_MARKERS.blue.map((m) => `${m.role}:${m.side}:${m.art}`)).toEqual([
      'headSide:left:mirrored',
      'footSide:right:authored',
    ])
    expect(viewSource).toMatch(/this\.gripMarkers = GRIP_SUCCESS_MARKERS\[art\.id\]\.map/)
    expect(viewSource).toMatch(/GRIP_SUCCESS_MARKERS\[this\.idleArt\.id\]\.forEach/)
    expect(shownCount(neutralGrapple().getSnapshot())).toBe(4)
    // the ACTION-11K procedural drawing is gone
    expect(viewSource).not.toMatch(/ensureGripSymbolTexture|GRIP_SYMBOL_SKIN|GRIP_SYMBOL_SHADE|grip-symbol-\$\{/)
    expect(symbolSource).not.toMatch(/GRIP_SUCCESS_SYMBOL\b/)
  })

  it('11N: both markers follow the User Play Test reference (exact values)', () => {
    expect(GRIP_SUCCESS_MARKERS.red).toEqual([
      { role: 'headSide', side: 'right', art: 'authored', handForwardR: -0.4, handLateralR: 0.8, elbowForwardR: 0.25, elbowLateralR: 1.15 },
      { role: 'footSide', side: 'left', art: 'mirrored', handForwardR: -0.55, handLateralR: -0.45, elbowForwardR: -0.05, elbowLateralR: -0.95 },
    ])
    // blue is the red art reflected across the local X axis: the same set mirrored laterally
    for (const role of ['headSide', 'footSide'] as const) {
      const r = roleOf('red', role)
      const b = roleOf('blue', role)
      expect([b.handForwardR, b.handLateralR, b.elbowForwardR, b.elbowLateralR]).toEqual([
        r.handForwardR,
        -r.handLateralR,
        r.elbowForwardR,
        -r.elbowLateralR,
      ])
      expect(b.art).toBe(r.art === 'authored' ? 'mirrored' : 'authored')
    }
  })

  it('11N: elbows come out beside the target front shoulder (outside / on its outline), not from the opponent', () => {
    for (const m of ALL_MARKERS) {
      expect(m.elbowForwardR).toBeGreaterThan(m.handForwardR + 0.4) // forearm runs forward from the fist
      expect(Math.hypot(m.elbowForwardR, m.elbowLateralR)).toBeGreaterThan(0.9) // at / beyond the body outline
      expect(Math.abs(m.elbowLateralR)).toBeGreaterThan(Math.abs(m.handLateralR)) // on the outside of the fist
      expect(Math.hypot(m.elbowForwardR - 1.72, m.elbowLateralR)).toBeGreaterThan(1.5) // far from the gripping opponent
    }
    for (const art of ['red', 'blue'] as const) {
      const head = roleOf(art, 'headSide')
      const foot = roleOf(art, 'footSide')
      expect(Math.sign(foot.handLateralR)).toBe(-Math.sign(head.handLateralR))
    }
  })

  it('G3: fists on opposite sides of the mawashi (back half of the waist, inside the body)', () => {
    for (const m of ALL_MARKERS) {
      expect(m.handForwardR).toBeLessThan(-0.3)
      expect(Math.hypot(m.handForwardR, m.handLateralR)).toBeLessThan(0.95)
    }
  })

  it('11N-4: reflection only swaps the texture; the fist anchor world position is invariant', () => {
    for (const m of ALL_MARKERS) {
      const other = { ...m, art: m.art === 'authored' ? ('mirrored' as const) : ('authored' as const) }
      for (const f of [0, 1.1, Math.PI, -2.3]) {
        const a = gripMarkerPlacement(m, CENTER, f, R_PX)
        const b = gripMarkerPlacement(other, CENTER, f, R_PX)
        expect(a.hand).toEqual(b.hand)
        expect(a.elbow).toEqual(b.elbow)
      }
    }
  })

  it('G4 / G5: head side 61.70 deg / 0.74 R, foot side 45 deg / 0.71 R; texture scale gives the displayed length', () => {
    for (const m of ALL_MARKERS) {
      const [df, dl] = m.role === 'headSide' ? [0.65, 0.35] : [0.5, 0.5]
      expect(gripMarkerWaistAngleDeg(m)).toBeCloseTo((Math.atan2(df, dl) * 180) / Math.PI, 9)
      expect(gripMarkerLengthR(m)).toBeCloseTo(Math.hypot(df, dl), 9)
      expect(gripMarkerLengthR(m)).toBeGreaterThanOrEqual(0.65)
      expect(gripMarkerLengthR(m)).toBeLessThanOrEqual(0.75)
      const p = gripMarkerPlacement(m, CENTER, 0.3, R_PX)
      expect(p.lengthPx).toBeCloseTo(gripMarkerLengthR(m) * R_PX, 9)
      const art = GRIP_MARKER_ART[m.art]
      expect(Math.hypot(art.hand.x - art.elbow.x, art.hand.y - art.elbow.y) * p.scale).toBeCloseTo(p.lengthPx, 9)
    }
  })

  it('G6: rigid transform for facing 0, pi/2, pi, -pi/2; the texture hand anchor lands on the fist point', () => {
    for (const m of ALL_MARKERS) {
      const art = GRIP_MARKER_ART[m.art]
      const p0 = gripMarkerPlacement(m, CENTER, 0, R_PX)
      expect(p0.hand.x).toBeCloseTo(CENTER.x + m.handForwardR * R_PX, 9)
      expect(p0.hand.y).toBeCloseTo(CENTER.y + m.handLateralR * R_PX, 9)
      for (const f of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const p = gripMarkerPlacement(m, CENTER, f, R_PX)
        const hand = at(CENTER, f, m.handForwardR, m.handLateralR)
        const elbow = at(CENTER, f, m.elbowForwardR, m.elbowLateralR)
        expect(p.hand.x).toBeCloseTo(hand.x, 9)
        expect(p.hand.y).toBeCloseTo(hand.y, 9)
        expect(p.elbow.x).toBeCloseTo(elbow.x, 9)
        expect(p.elbow.y).toBeCloseTo(elbow.y, 9)
        // rotating + scaling the texture's elbow anchor about the hand anchor lands on the elbow point
        const dx = (art.elbow.x - art.hand.x) * p.scale
        const dy = (art.elbow.y - art.hand.y) * p.scale
        const c = Math.cos(p.rotation)
        const s = Math.sin(p.rotation)
        expect(p.hand.x + dx * c - dy * s).toBeCloseTo(elbow.x, 9)
        expect(p.hand.y + dx * s + dy * c).toBeCloseTo(elbow.y, 9)
        expect(p.scale).toBeCloseTo(p0.scale, 12)
      }
    }
  })

  it('G7: the four fists of a face-to-face pair are deterministic and well apart', () => {
    const s = neutralGrapple().getSnapshot()
    const hands = s.participants.flatMap((p, i) => {
      const display = gripSuccessDisplayOffsetPx(visualOf(s, i as 0 | 1), p.facing, R_PX)
      const center = { x: 300 + (p.position.x * R_PX) / BODY_RADIUS + display.x, y: 200 + (p.position.y * R_PX) / BODY_RADIUS + display.y }
      return GRIP_SUCCESS_MARKERS[ART_OF[i]].map((m) => {
        expect(gripMarkerPlacement(m, center, p.facing, R_PX)).toEqual(gripMarkerPlacement(m, center, p.facing, R_PX))
        return gripMarkerPlacement(m, center, p.facing, R_PX).hand
      })
    })
    expect(hands).toHaveLength(4)
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        expect(Math.hypot(hands[i].x - hands[j].x, hands[i].y - hands[j].y)).toBeGreaterThan(0.8 * R_PX)
      }
    }
  })

  it('anchored to the displayed (ACTION-11F offset) center of the target', () => {
    const s = neutralGrapple().getSnapshot()
    const facing = s.participants[0].facing
    const canonical = { x: 100, y: 100 }
    const display = gripSuccessDisplayOffsetPx(visualOf(s, 0), facing, R_PX)
    const m = roleOf('blue', 'footSide') // any marker; the anchor rule is the same
    const p = gripMarkerPlacement(m, { x: canonical.x + display.x, y: canonical.y + display.y }, facing, R_PX)
    const expected = at(canonical, facing, m.handForwardR + GRIP_SUCCESS_FORWARD_OFFSET_R, m.handLateralR + GRIP_SUCCESS_LATERAL_OFFSET_R)
    expect(p.hand.x).toBeCloseTo(expected.x, 9)
    expect(p.hand.y).toBeCloseTo(expected.y, 9)
  })

  it('V1: READY neutral -> four visible', () => {
    expect(shownCount(neutralGrapple().getSnapshot())).toBe(4)
  })

  it('V2: READY Drive -> four visible, no flicker', () => {
    const sim = neutralGrapple()
    const poses = new Set<string>()
    for (let k = 0; k < 40; k++) {
      sim.step(intents({ drive: true, move: [1, 0] }, { drive: k % 3 === 0 }))
      poses.add(visualOf(sim.getSnapshot(), 0).pose)
      expect(shownCount(sim.getSnapshot())).toBe(4)
    }
    expect(poses).toContain('drive')
  })

  it('V3: READY Morozashi holder / disadvantaged -> four visible', () => {
    const s = morozashiGrapple().getSnapshot()
    expect(visualOf(s, 0).grappleRole).toBe('morozashi-holder')
    expect(visualOf(s, 1).grappleRole).toBe('morozashi-disadvantaged')
    expect(shownCount(s)).toBe(4)
  })

  it('V4: either TURNING -> zero; all four appear on the same tick once both are READY', () => {
    const sim = turningGrapple()
    const v = visualOf(sim.getSnapshot(), 1)
    expect(gripSuccessPairSymbolVisible({ ...v, turning: true }, { ...v, turning: true })).toBe(false)
    let hidden = 0
    let shownAt = -1
    for (let k = 0; k < 400 && shownAt < 0; k++) {
      const n = shownCount(sim.getSnapshot())
      expect([0, 4]).toContain(n)
      if (n === 4) shownAt = k
      else hidden++
      sim.step(intents())
    }
    expect(hidden).toBeGreaterThan(0)
    expect(shownAt).toBeGreaterThan(0)
    for (let k = 0; k < 30; k++) {
      sim.step(intents())
      expect(shownCount(sim.getSnapshot())).toBe(4)
    }
  })

  it('V5 / V6: zero through the Grip attempt, on the release tick and through recovery', () => {
    const sim = newSim(COMBINED)
    sim.step(intents({ grip: true }))
    while (sim.getSnapshot().engagement.kind === 'free') {
      expect(shownCount(sim.getSnapshot())).toBe(0)
      sim.step(intents())
    }
    expect(shownCount(sim.getSnapshot())).toBe(4)
    sim.step(intents({ grip: true })) // release
    for (let k = 0; k <= GRIP_RECOVERY_TICKS; k++) {
      expect(shownCount(sim.getSnapshot())).toBe(0)
      sim.step(intents())
    }
  })

  it('V7: zero for idle, Push, Tsuppari, Counter and Kuzushi', () => {
    const sim = newSim(FAR)
    const seen = new Set<string>()
    const steps: Input[] = [{}, { left: true }, ...Array(40).fill({}), { counter: true }, ...Array(120).fill({}), { push: true }, ...Array(60).fill({})]
    for (const step of steps) {
      sim.step(intents(step))
      seen.add(visualOf(sim.getSnapshot()).pose)
      expect(shownCount(sim.getSnapshot())).toBe(0)
    }
    expect([...seen]).toEqual(expect.arrayContaining(['idle', 'tsuppari', 'counter', 'kuzushi', 'push']))
  })

  it('P1 / P3 / P4: Snapshot unchanged, bond 0.70 m, ACTION-11F constants unchanged', () => {
    const sim = neutralGrapple()
    const before = JSON.stringify(sim.getSnapshot())
    for (const who of [0, 1] as const) {
      visibleOf(sim.getSnapshot(), who)
      for (const m of GRIP_SUCCESS_MARKERS[ART_OF[who]]) gripMarkerPlacement(m, CENTER, sim.getSnapshot().participants[who].facing, R_PX)
    }
    const s = sim.getSnapshot()
    expect(JSON.stringify(s)).toBe(before)
    const [a, b] = s.participants
    expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)).toBeCloseTo(COMBINED, 9)
    expect(GRIP_SUCCESS_FORWARD_OFFSET_R).toBe(0.14)
    expect(GRIP_SUCCESS_LATERAL_OFFSET_R).toBe(-0.2)
  })

  it('Phaser-free; WrestlerView draws them above both bodies from the displayed center with the pair rule', () => {
    expect(symbolSource).not.toMatch(/from ['"]phaser['"]/)
    expect(symbolSource).not.toMatch(/BoutSimulation/)
    expect(viewSource).toMatch(/GRIP_SYMBOL_DEPTH = 2\.3\b/)
    expect(viewSource).toMatch(/WRESTLER_BODY_DEPTH = 2\b/)
    expect(viewSource).toMatch(/WRESTLER_EFFECT_DEPTH = 2\.5\b/)
    expect(viewSource).toMatch(/const symbolVisible = gripSuccessPairSymbolVisible\(state, opponentState\)/)
    expect(viewSource).toMatch(/const center = \{ x: positionPx\.x \+ display\.x, y: positionPx\.y \+ display\.y \}/)
    expect(viewSource).toMatch(/gripMarkerPlacement\(marker, center, participant\.facing, this\.R\)/)
    expect(viewSource).toMatch(/\.setOrigin\(markerArt\.hand\.x \/ markerArt\.width, markerArt\.hand\.y \/ markerArt\.height\)/)
    expect(sceneSource).toMatch(/view\.wrestler\.apply\(visual, participant, pos, opponentVisual\)/)
  })
})
