import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  PUSH_ACTIVE_TICKS,
  PUSH_STARTUP_TICKS,
} from '../sumo/BoutSimulation.ts'
import type { BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, ParticipantState } from '../sumo/BoutTypes.ts'
import { MOVE_ENTER_SPEED, MOVE_EXIT_SPEED, resolveWrestlerVisualState } from './wrestlerVisualState.ts'
import visualStateSource from './wrestlerVisualState.ts?raw'

const COMBINED = 2 * BODY_RADIUS

function setupAt(ax: number, ay: number, bx: number, by: number, radius = 100): BoutSetup {
  return {
    arena: { radius },
    participants: [
      { id: 'a', position: { x: ax, y: ay } },
      { id: 'b', position: { x: bx, y: by } },
    ],
  }
}

interface Input {
  move?: [number, number]
  push?: boolean
  counter?: boolean
  grip?: boolean
  drive?: boolean
}

const one = (i: Input): ParticipantIntent => ({
  move: { x: i.move?.[0] ?? 0, y: i.move?.[1] ?? 0 },
  pushPressed: i.push ?? false,
  counterPressed: i.counter ?? false,
  gripPressed: i.grip ?? false,
  driveHeld: i.drive ?? false,
})

function intents(a: Input = {}, b: Input = {}): Map<ParticipantId, ParticipantIntent> {
  return new Map([
    ['a', one(a)],
    ['b', one(b)],
  ])
}

const touching = (radius = 100) => new BoutSimulation(setupAt(-COMBINED / 2, 0, COMBINED / 2, 0, radius))
const vis = (s: BoutSnapshot, which: 0 | 1, wasMoving = false) =>
  resolveWrestlerVisualState(s.participants[which], s.participants[1 - which], s.engagement, s.outcome, wasMoving)

describe('wrestler visual state (VISUAL-01A)', () => {
  it('idle when standing still; move when walking, with hysteresis', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    expect(vis(sim.getSnapshot(), 0).pose).toBe('idle')
    for (let k = 0; k < 10; k++) sim.step(intents({ move: [0, 1] }))
    const s = sim.getSnapshot()
    expect(vis(s, 0).pose).toBe('move')
    expect(vis(s, 0).locomotionSpeed).toBeGreaterThan(MOVE_ENTER_SPEED)
    // hysteresis: a speed between the exit and enter thresholds keeps the previous pose
    const mid = { ...s.participants[0], velocity: { x: 0, y: (MOVE_ENTER_SPEED + MOVE_EXIT_SPEED) / 2 } }
    expect(resolveWrestlerVisualState(mid, s.participants[1], s.engagement, s.outcome, true).pose).toBe('move')
    expect(resolveWrestlerVisualState(mid, s.participants[1], s.engagement, s.outcome, false).pose).toBe('idle')
  })

  it('locomotion uses own footwork only (external push momentum is not walking)', () => {
    const sim = touching()
    sim.step(intents({}, { push: true }))
    for (let k = 0; k < PUSH_STARTUP_TICKS + PUSH_ACTIVE_TICKS; k++) sim.step(intents())
    const s = sim.getSnapshot()
    expect(Math.hypot(s.participants[0].externalVelocity.x, s.participants[0].externalVelocity.y)).toBeGreaterThan(0.3)
    expect(vis(s, 0).pose).toBe('idle') // being driven back, not walking
  })

  it('push maps startup / active / recovery with progress from ticksRemaining', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ push: true }))
    let v = vis(sim.getSnapshot(), 0)
    expect(v.pose).toBe('push')
    expect(v.pushPhase).toBe('startup')
    expect(v.phaseProgress).toBeCloseTo(1 / PUSH_STARTUP_TICKS, 12)
    for (let k = 1; k < PUSH_STARTUP_TICKS; k++) sim.step(intents())
    v = vis(sim.getSnapshot(), 0)
    expect(v.pushPhase).toBe('active')
    expect(v.phaseProgress).toBe(0)
    for (let k = 0; k < PUSH_ACTIVE_TICKS; k++) sim.step(intents())
    expect(vis(sim.getSnapshot(), 0).pushPhase).toBe('recovery')
    for (let k = 0; k < 20; k++) sim.step(intents())
    expect(vis(sim.getSnapshot(), 0).pose).toBe('idle')
  })

  it('counter window, grip reach and grip recovery', () => {
    const c = new BoutSimulation(setupAt(-2, 0, 2, 0))
    c.step(intents({ counter: true }))
    expect(vis(c.getSnapshot(), 0).pose).toBe('counter')
    const g = new BoutSimulation(setupAt(-2, 0, 2, 0))
    g.step(intents({ grip: true }))
    expect(vis(g.getSnapshot(), 0)).toMatchObject({ pose: 'grip', gripPhase: 'reach' })
    for (let k = 0; k < 6; k++) g.step(intents())
    expect(vis(g.getSnapshot(), 0)).toMatchObject({ pose: 'grip', gripPhase: 'recovery' })
  })

  it('kuzushi has priority and carries a decaying strength', () => {
    const sim = new BoutSimulation(setupAt(-2, 0, 2, 0))
    sim.step(intents({ counter: true }))
    for (let k = 1; k < COUNTER_WINDOW_TICKS; k++) sim.step(intents({ move: [1, 0] }))
    const first = vis(sim.getSnapshot(), 0)
    expect(first.pose).toBe('kuzushi')
    expect(first.kuzushiStrength).toBe(1)
    for (let k = 0; k < 15; k++) sim.step(intents({ move: [1, 0] }))
    expect(vis(sim.getSnapshot(), 0).kuzushiStrength).toBeCloseTo(0.5, 12)
  })

  it('grapple roles: neutral, Morozashi holder / disadvantaged (mirrored by participant)', () => {
    const neutral = touching()
    neutral.step(intents({ grip: true }))
    expect(vis(neutral.getSnapshot(), 0)).toMatchObject({ pose: 'grapple', grappleRole: 'neutral', turning: false })
    expect(vis(neutral.getSnapshot(), 1)).toMatchObject({ pose: 'grapple', grappleRole: 'neutral', turning: false })

    for (const holder of ['a', 'b'] as const) {
      const sim = touching()
      for (let t = 0; t < COUNTER_WINDOW_TICKS; t++) {
        sim.step(holder === 'a' ? intents({}, { counter: t === 0 }) : intents({ counter: t === 0 }))
      }
      sim.step(holder === 'a' ? intents({ grip: true }) : intents({}, { grip: true }))
      const s = sim.getSnapshot()
      const h = holder === 'a' ? 0 : 1
      expect(vis(s, h).grappleRole).toBe('morozashi-holder')
      expect(vis(s, (1 - h) as 0 | 1).grappleRole).toBe('morozashi-disadvantaged')
    }
  })

  it('turning while not READY (rear grip), then ready; drive while READY and holding', () => {
    const sim = touching()
    for (let t = 0; t <= PUSH_STARTUP_TICKS; t++) sim.step(intents({ counter: t === 0 }, { push: t === 0 }))
    for (let t = 0; t < COUNTER_TRANSITION_TICKS; t++) sim.step(intents())
    sim.step(intents({ grip: true }))
    let s = sim.getSnapshot()
    expect(vis(s, 1)).toMatchObject({ pose: 'grapple', grappleRole: 'morozashi-disadvantaged', turning: true })
    expect(vis(s, 0)).toMatchObject({ grappleRole: 'morozashi-holder', turning: false })
    sim.step(intents({ drive: true }, { drive: true }))
    s = sim.getSnapshot()
    expect(vis(s, 0).pose).toBe('drive')
    expect(vis(s, 1)).toMatchObject({ pose: 'grapple', turning: true }) // held Drive does not count yet
    for (let k = 0; k < 80; k++) sim.step(intents({ drive: true }, { drive: true }))
    expect(vis(sim.getSnapshot(), 1)).toMatchObject({ pose: 'drive', turning: false })
  })

  it('a decided outcome only adds the frozen modifier (the last pose is kept)', () => {
    const sim = new BoutSimulation(setupAt(4.8, 0, -1, 0, 5))
    let s = sim.getSnapshot()
    for (let k = 0; k < 60 && s.outcome.kind === 'ongoing'; k++) {
      sim.step(intents({ move: [1, 0] }))
      s = sim.getSnapshot()
    }
    expect(s.outcome.kind).toBe('win')
    expect(vis(s, 0, true)).toMatchObject({ pose: 'move', frozen: true })
    expect(vis(s, 1).frozen).toBe(true)
  })

  it('is deterministic and Phaser-free', () => {
    const sim = touching()
    sim.step(intents({ grip: true }))
    const s = sim.getSnapshot()
    expect(vis(s, 0)).toEqual(vis(s, 0))
    const p: ParticipantState = s.participants[0]
    expect(resolveWrestlerVisualState(p, s.participants[1], s.engagement, s.outcome, false)).toEqual(vis(s, 0))
    expect(visualStateSource).not.toMatch(/from ['"]phaser['"]/)
  })
})
