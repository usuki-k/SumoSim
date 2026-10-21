import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  BoutSimulation,
  COUNTER_STAGGER_DISTANCE,
  COUNTER_TRANSITION_TICKS,
  COUNTER_WINDOW_TICKS,
  KUZUSHI_TICKS,
  PUSH_STARTUP_TICKS,
  TICK_SECONDS,
  counterRelocationTarget,
  counterStaggerEase,
  counterWrapEase,
} from './BoutSimulation.ts'
import type { ArenaSetup, BoutSetup, BoutSnapshot, ParticipantId, ParticipantIntent, Vec2 } from './BoutTypes.ts'
import { PushDummyController } from '../input/pushDummyController.ts'
import { resolveArenaRingOut } from './ringOut.ts'

const COMBINED = 2 * BODY_RADIUS
const N = COUNTER_TRANSITION_TICKS
const SUCCESS_TICK = PUSH_STARTUP_TICKS + 4
const TOKUDAWARA = { depth: 0.1194375, halfAngle: Math.PI / 20 } // accepted Product Tokudawara

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
  tsuppariLeftPressed: false,
  tsuppariRightPressed: false,
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

const IDLE = intents()
const A = (s: BoutSnapshot) => s.participants[0]
const B = (s: BoutSnapshot) => s.participants[1]
const dist = (s: BoutSnapshot) => Math.hypot(B(s).position.x - A(s).position.x, B(s).position.y - A(s).position.y)
const radial = (p: Vec2) => Math.hypot(p.x, p.y)
const sub = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x - q.x, y: p.y - q.y })

function expectAt(p: Vec2, q: Vec2, digits = 12): void {
  expect(p.x).toBeCloseTo(q.x, digits)
  expect(p.y).toBeCloseTo(q.y, digits)
}

function expectFinite(s: BoutSnapshot): void {
  for (const p of s.participants) {
    for (const v of [p.position.x, p.position.y, p.velocity.x, p.velocity.y, p.externalVelocity.x, p.externalVelocity.y, p.facing]) {
      expect(Number.isFinite(v)).toBe(true)
    }
  }
}

interface Scenario {
  // pair midpoint and the axis angle phi: A (Counter user) at mid - u*R, B (pusher) at mid + u*R, B pushes
  // toward A. counterTick 0 = Best; SUCCESS_TICK = Success. A walks along u rotated +90 deg * lateral on
  // ticks 1..walkTicks before its Counter.
  mid?: Vec2
  phi?: number
  arena?: ArenaSetup
  counterTick?: number
  lateral?: number
  walkTicks?: number
  swapOrder?: boolean
}

function setupOf(o: Scenario): BoutSetup {
  const mid = o.mid ?? { x: 0, y: 0 }
  const phi = o.phi ?? 0
  const u = { x: Math.cos(phi), y: Math.sin(phi) }
  const a = { id: 'a', position: { x: mid.x - (u.x * COMBINED) / 2, y: mid.y - (u.y * COMBINED) / 2 } }
  const b = { id: 'b', position: { x: mid.x + (u.x * COMBINED) / 2, y: mid.y + (u.y * COMBINED) / 2 } }
  return { arena: o.arena ?? { radius: 100 }, participants: o.swapOrder ? [b, a] : [a, b] }
}

// Runs until the Counter transition starts; returns the simulation and the Snapshots around the catch.
function catchCounter(o: Scenario = {}) {
  const sim = new BoutSimulation(setupOf(o))
  const phi = o.phi ?? 0
  const lateral = o.lateral ?? 0
  const walkTicks = o.walkTicks ?? 4
  const counterTick = o.counterTick ?? 0
  const walk: [number, number] = [-Math.sin(phi) * lateral, Math.cos(phi) * lateral]
  for (let t = 0; t < 40; t++) {
    const before = sim.getSnapshot()
    sim.step(intents({ counter: t === counterTick, move: lateral !== 0 && t >= 1 && t <= walkTicks ? walk : undefined }, { push: t === 0 }))
    const after = sim.getSnapshot()
    if (after.counterTransition.kind === 'active') return { sim, before, after, t }
  }
  throw new Error('no Counter transition')
}

const byId = (s: BoutSnapshot, id: string) => s.participants.find((p) => p.id === id)!

function lockedDirection(s: BoutSnapshot, pusherId = 'b'): Vec2 {
  const action = byId(s, pusherId).action
  if (action.kind !== 'push') throw new Error('pusher not pushing')
  return action.direction
}

// The expected canonical positions on transition tick k (1..N) from the documented path model.
function expectedPath(entry: BoutSnapshot, d: Vec2, k: number, arenaRadius = 100) {
  const t = entry.counterTransition
  if (t.kind !== 'active') throw new Error('not active')
  const p0 = byId(entry, t.pusherId).position
  const c0 = byId(entry, t.counterUserId).position
  const end = { x: p0.x + d.x * COUNTER_STAGGER_DISTANCE, y: p0.y + d.y * COUNTER_STAGGER_DISTANCE }
  const target = counterRelocationTarget(t.tier, end, d, COMBINED, c0, arenaRadius - BODY_RADIUS)!
  const rel = sub(c0, p0)
  const r0 = Math.hypot(rel.x, rel.y)
  const theta0 = Math.atan2(-d.y * rel.x + d.x * rel.y, d.x * rel.x + d.y * rel.y)
  if (k === N) return { pusher: end, counterUser: { x: target.x, y: target.y }, target }
  const u = k / N
  const stagger = COUNTER_STAGGER_DISTANCE * counterStaggerEase(u)
  const pusher = { x: p0.x + d.x * stagger, y: p0.y + d.y * stagger }
  const w = counterWrapEase(u)
  const r = r0 + (COMBINED - r0) * w
  const theta = theta0 + (target.theta - theta0) * w
  const along = r * Math.cos(theta)
  const across = r * Math.sin(theta)
  return {
    pusher,
    counterUser: { x: pusher.x + d.x * along - d.y * across, y: pusher.y + d.y * along + d.x * across },
    target,
  }
}

describe('Counter transition (ACTION-04A4)', () => {
  // ---- entry / duration ----------------------------------------------------------------------------

  it('Success and Best captures start an active pair transition with roles, tier and full ticks', () => {
    const success = catchCounter({ counterTick: SUCCESS_TICK })
    expect(success.after.counterTransition).toEqual({
      kind: 'active',
      tier: 'success',
      counterUserId: 'a',
      pusherId: 'b',
      ticksRemaining: N,
    })
    const best = catchCounter({ counterTick: 0 })
    expect(best.after.counterTransition).toEqual({
      kind: 'active',
      tier: 'best',
      counterUserId: 'a',
      pusherId: 'b',
      ticksRemaining: N,
    })
    expect(N).toBe(90) // ACTION-04A5: ~1.5 s
    for (const s of [success.after, best.after]) {
      expect(s.engagement).toEqual({ kind: 'free' })
      expect(A(s).action).toEqual({ kind: 'idle' })
      expect(B(s).action).toEqual({ kind: 'idle' })
      expect(B(s).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
      expect(A(s).posture).toEqual({ kind: 'stable' })
    }
  })

  it('the capture tick does not teleport the Counter user (it stays at its resolved contact place)', () => {
    for (const counterTick of [0, SUCCESS_TICK]) {
      const { before, after } = catchCounter({ counterTick })
      expect(dist(after)).toBeLessThanOrEqual(COMBINED + 0.002)
      expect(dist(after)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
      expect(radial(sub(A(after).position, A(before).position))).toBeLessThan(0.05) // not ~1 m
    }
  })

  it('lasts exactly N transition ticks: ticksRemaining N..1, completion at the end of tick N', () => {
    const { sim } = catchCounter()
    for (let k = 1; k <= N; k++) {
      expect(sim.getSnapshot().counterTransition).toMatchObject({ kind: 'active', ticksRemaining: N - k + 1 })
      sim.step(IDLE)
    }
    expect(sim.getSnapshot().counterTransition).toEqual({ kind: 'none' })
  })

  it('the same intent script reproduces the identical transition path', () => {
    const record = () => {
      const { sim } = catchCounter({ counterTick: SUCCESS_TICK, lateral: 1 })
      const out: BoutSnapshot[] = []
      for (let k = 0; k <= N + 5; k++) {
        sim.step(intents({ move: [1, 0], push: k % 7 === 0 }, { counter: k % 5 === 0 }))
        out.push(sim.getSnapshot())
      }
      return out
    }
    expect(record()).toEqual(record())
  })

  // ---- input lock -----------------------------------------------------------------------------------

  it('ignores movement, Push, Counter, Grip and Drive for both participants (path identical to idle)', () => {
    const idle = catchCounter()
    const noisy = catchCounter()
    const scripts = [
      intents({ move: [1, 0] }, { move: [-1, 1] }),
      intents({ push: true }, { push: true }),
      intents({ counter: true }, { counter: true }),
      intents({ grip: true }, { grip: true }),
      intents({ drive: true, move: [0, 1] }, { drive: true }),
    ]
    for (let k = 0; k < N; k++) {
      idle.sim.step(IDLE)
      noisy.sim.step(scripts[k % scripts.length])
      const s = noisy.sim.getSnapshot()
      expect(s).toEqual(idle.sim.getSnapshot())
      for (const p of s.participants) expect(p.action).toEqual({ kind: 'idle' })
      expect(s.engagement).toEqual({ kind: 'free' })
    }
  })

  it('held movement acts on the first tick after completion; discrete edges pressed during it are not queued', () => {
    const { sim } = catchCounter()
    for (let k = 0; k < N; k++) sim.step(intents({ push: true, counter: true, grip: true, move: [0, 1] }))
    const done = sim.getSnapshot()
    expect(done.counterTransition).toEqual({ kind: 'none' })
    expect(A(done).velocity).toEqual({ x: 0, y: 0 })
    // first free tick: held WASD acts, no press edge -> no queued Push / Counter / Grip
    sim.step(intents({ move: [0, 1] }))
    const s = sim.getSnapshot()
    expect(A(s).velocity.y).toBeGreaterThan(0)
    expect(A(s).action).toEqual({ kind: 'idle' })
    expect(B(s).action).toEqual({ kind: 'idle' })
    // a new edge after completion does count
    sim.step(intents({ push: true }))
    expect(A(sim.getSnapshot()).action.kind).toBe('push')
  })

  // ---- D1 / D4 path ---------------------------------------------------------------------------------

  it('follows the documented deterministic path exactly every tick (no contact correction interferes)', () => {
    for (const o of [{ counterTick: 0 }, { counterTick: SUCCESS_TICK }, { counterTick: SUCCESS_TICK, lateral: -1 }]) {
      const { sim, before, after } = catchCounter(o)
      const d = lockedDirection(before)
      for (let k = 1; k <= N; k++) {
        sim.step(IDLE)
        const s = sim.getSnapshot()
        const e = expectedPath(after, d, k)
        expectAt(B(s).position, e.pusher)
        expectAt(A(s).position, e.counterUser)
      }
    }
  })

  it('D1 / D4: the pusher staggers exactly 1.0R along d; Success ends at its true side, Best at its true rear', () => {
    expect(COUNTER_STAGGER_DISTANCE).toBe(BODY_RADIUS)
    for (const [counterTick, tier] of [
      [0, 'best'],
      [SUCCESS_TICK, 'success'],
    ] as const) {
      const { sim, before, after } = catchCounter({ counterTick })
      const d = lockedDirection(before)
      for (let k = 0; k < N; k++) sim.step(IDLE)
      const s = sim.getSnapshot()
      const moved = sub(B(s).position, B(after).position)
      expectAt(moved, { x: d.x * BODY_RADIUS, y: d.y * BODY_RADIUS })
      const rel = sub(A(s).position, B(s).position)
      expect(Math.hypot(rel.x, rel.y)).toBeCloseTo(COMBINED, 12)
      const along = rel.x * d.x + rel.y * d.y
      if (tier === 'best') expect(along).toBeCloseTo(-COMBINED, 12) // true rear
      else expect(along).toBeCloseTo(0, 12) // true side
    }
  })

  it('the pair never overlaps and the Counter user never passes through the pusher', () => {
    for (const o of [
      { counterTick: 0 },
      { counterTick: 0, lateral: 1 },
      { counterTick: SUCCESS_TICK, lateral: 1 },
      { counterTick: SUCCESS_TICK, lateral: -1 },
      { counterTick: PUSH_STARTUP_TICKS + 7 },
    ]) {
      const { sim } = catchCounter(o)
      for (let k = 0; k < N; k++) {
        sim.step(IDLE)
        const s = sim.getSnapshot()
        expectFinite(s)
        expect(dist(s)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
      }
    }
  })

  it('Success uses both side preferences; Best wraps around its preferred side deterministically', () => {
    const lateralAt = (s: BoutSnapshot, d: Vec2) => {
      const rel = sub(A(s).position, B(s).position)
      return -d.y * rel.x + d.x * rel.y // along perp = (-d.y, d.x)
    }
    for (const lateral of [1, -1]) {
      // Success: A leans by walking; it ends on that side
      const success = catchCounter({ counterTick: SUCCESS_TICK, lateral })
      const ds = lockedDirection(success.before)
      for (let k = 0; k < N; k++) success.sim.step(IDLE)
      expect(Math.sign(lateralAt(success.sim.getSnapshot(), ds))).toBe(Math.sign(lateralAt(success.after, ds)))
    }
    // Best on the axis (tie): the ring-center-nearer side; at the ring center the fixed side+ -> wraps via +perp
    const best = catchCounter({ counterTick: 0 })
    const d = lockedDirection(best.before)
    let minLateral = Infinity
    let maxLateral = -Infinity
    for (let k = 0; k < N; k++) {
      best.sim.step(IDLE)
      const l = lateralAt(best.sim.getSnapshot(), d)
      minLateral = Math.min(minLateral, l)
      maxLateral = Math.max(maxLateral, l)
    }
    expect(maxLateral).toBeGreaterThan(0.5) // goes around the + side
    expect(minLateral).toBeGreaterThan(-1e-9) // never via the - side
    // and the same Best replayed wraps the same way
    const again = catchCounter({ counterTick: 0 })
    for (let k = 0; k < N / 2; k++) again.sim.step(IDLE)
    expect(lateralAt(again.sim.getSnapshot(), d)).toBeGreaterThan(0)
  })

  // ---- D3 momentum ----------------------------------------------------------------------------------

  it('D3: entry clears self and external velocity of both; the path does not depend on prior momentum', () => {
    const best = catchCounter({ counterTick: 0 }) // little prior momentum
    const late = catchCounter({ counterTick: PUSH_STARTUP_TICKS + 7 }) // large prior pair momentum
    expect(Math.hypot(B(late.before).externalVelocity.x, B(late.before).externalVelocity.y)).toBeGreaterThan(1)
    expect(Math.hypot(B(late.before).velocity.x - B(late.before).externalVelocity.x, B(late.before).velocity.y)).toBeGreaterThan(0)
    for (const run of [best, late]) {
      for (const p of run.after.participants) {
        expect(p.velocity).toEqual({ x: 0, y: 0 })
        expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
      }
      const d = lockedDirection(run.before)
      for (let k = 1; k <= N; k++) {
        run.sim.step(IDLE)
        const moved = sub(B(run.sim.getSnapshot()).position, B(run.after).position)
        const expected = k === N ? 1 : counterStaggerEase(k / N)
        expectAt(moved, { x: d.x * BODY_RADIUS * expected, y: d.y * BODY_RADIUS * expected })
      }
    }
  })

  // ---- velocity bookkeeping -------------------------------------------------------------------------

  it('velocities report the per-tick path displacement: pusher external, Counter user own footwork', () => {
    const { sim } = catchCounter({ counterTick: SUCCESS_TICK, lateral: 1 })
    for (let k = 1; k <= N; k++) {
      const prev = sim.getSnapshot()
      sim.step(IDLE)
      const s = sim.getSnapshot()
      const pusherStep = sub(B(s).position, B(prev).position)
      const userStep = sub(A(s).position, A(prev).position)
      if (k < N) {
        expectAt(B(s).externalVelocity, { x: pusherStep.x / TICK_SECONDS, y: pusherStep.y / TICK_SECONDS }, 9)
        expectAt(B(s).velocity, B(s).externalVelocity, 12) // no own footwork
        expectAt(A(s).velocity, { x: userStep.x / TICK_SECONDS, y: userStep.y / TICK_SECONDS }, 9)
        expect(A(s).externalVelocity).toEqual({ x: 0, y: 0 })
      } else {
        for (const p of s.participants) {
          expect(p.velocity).toEqual({ x: 0, y: 0 }) // normal completion zeroes both
          expect(p.externalVelocity).toEqual({ x: 0, y: 0 })
        }
      }
    }
  })

  // ---- ring-out / Tokudawara ------------------------------------------------------------------------

  // Fixtures found by an offline search over edge positions (Product ring 2.275 m, Tokudawara 21 px).
  const PUSHER_OUT: Scenario = {
    mid: { x: 2 * Math.cos((-12 * Math.PI) / 180), y: 2 * Math.sin((-12 * Math.PI) / 180) },
    phi: (10 * Math.PI) / 180,
    arena: { radius: 2.275, tokudawara: TOKUDAWARA },
    counterTick: 0,
  }
  // mid.x 1.75 -> 1.73 (ACTION-07B): the stronger Push carries the Counter user further before the catch.
  const COUNTER_USER_OUT: Scenario = { mid: { x: 1.73, y: 0 }, phi: Math.PI, arena: { radius: 2.275 }, counterTick: SUCCESS_TICK }

  function runTransition(o: Scenario) {
    const { sim, after } = catchCounter(o)
    const ticks: { prev: BoutSnapshot; cur: BoutSnapshot }[] = []
    for (let k = 1; k <= N && sim.getSnapshot().outcome.kind === 'ongoing'; k++) {
      const prev = sim.getSnapshot()
      sim.step(IDLE)
      ticks.push({ prev, cur: sim.getSnapshot() })
    }
    return { sim, entry: after, ticks, last: ticks[ticks.length - 1] }
  }

  it('the pusher can ring out mid-transition and loses immediately (Counter user wins)', () => {
    const { entry, ticks, last } = runTransition(PUSHER_OUT)
    expect(entry.counterTransition).toMatchObject({ kind: 'active', tier: 'best' })
    expect(last.cur.outcome).toEqual({ kind: 'win', winnerId: 'a', loserId: 'b', reason: 'ring-out' })
    expect(ticks.length).toBeLessThan(N)
    expect(last.cur.counterTransition).toMatchObject({ kind: 'active', ticksRemaining: N - ticks.length })
  })

  it('the Counter user can ring out mid-transition and loses immediately (no immunity)', () => {
    const { entry, ticks, last } = runTransition(COUNTER_USER_OUT)
    expect(entry.counterTransition).toMatchObject({ kind: 'active', tier: 'success' })
    // its final side target was valid (conservative circle), yet the moving path crosses the edge
    expect(last.cur.outcome).toEqual({ kind: 'win', winnerId: 'b', loserId: 'a', reason: 'ring-out' })
    expect(ticks.length).toBeLessThan(N)
    expect(radial(A(last.cur).position)).toBeGreaterThan(2.275)
    expect(radial(A(last.prev).position)).toBeLessThanOrEqual(2.275)
  })

  it('every transition tick decides exactly what the shared resolver decides for both segments', () => {
    const fixtures: Scenario[] = [PUSHER_OUT, COUNTER_USER_OUT, { counterTick: 0 }]
    for (let a = -12; a <= 12; a += 4) {
      for (const phi of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 6]) {
        fixtures.push({
          mid: { x: 1.9 * Math.cos((a * Math.PI) / 180), y: 1.9 * Math.sin((a * Math.PI) / 180) },
          phi,
          arena: { radius: 2.275, tokudawara: TOKUDAWARA },
          counterTick: SUCCESS_TICK,
          lateral: a >= 0 ? 1 : -1,
          walkTicks: PUSH_STARTUP_TICKS + 3,
        })
      }
    }
    let decided = 0
    for (const f of fixtures) {
      let run
      try {
        run = runTransition(f)
      } catch {
        continue // no Counter transition for this geometry (e.g. no valid target)
      }
      const arena = f.arena ?? { radius: 100 }
      for (const { prev, cur } of run.ticks) {
        const expected = resolveArenaRingOut(
          [
            { id: 'a', previous: A(prev).position, current: A(cur).position },
            { id: 'b', previous: B(prev).position, current: B(cur).position },
          ],
          arena,
        )
        expect(cur.outcome).toEqual(expected)
      }
      if (run.last.cur.outcome.kind !== 'ongoing') decided++
    }
    expect(decided).toBeGreaterThan(1)
  })

  it('exact boundary stays IN during the transition; just inside it the Counter user is OUT', () => {
    // Highest radial distance the Counter user reaches on a wide ring, then that exact radius as the ring.
    const wide = runTransition({ ...COUNTER_USER_OUT, arena: { radius: 100 } })
    let peak = 0
    let peakTick = -1
    wide.ticks.forEach(({ cur }, i) => {
      const r = radial(A(cur).position)
      if (r > peak) {
        peak = r
        peakTick = i + 1
      }
    })
    expect(peak).toBeGreaterThan(2.275)
    for (const { cur } of wide.ticks) expect(radial(B(cur).position)).toBeLessThan(peak)
    const exact = runTransition({ ...COUNTER_USER_OUT, arena: { radius: peak } })
    expect(exact.last.cur.outcome).toEqual({ kind: 'ongoing' }) // touches the line, still IN, completes
    expect(exact.ticks.length).toBe(N)
    const smaller = runTransition({ ...COUNTER_USER_OUT, arena: { radius: peak - peak * Number.EPSILON } })
    expect(smaller.last.cur.outcome).toEqual({ kind: 'win', winnerId: 'b', loserId: 'a', reason: 'ring-out' })
    expect(smaller.ticks.length).toBe(peakTick)
  })

  it('Tokudawara: the cardinal extension is respected during the transition (circle loses, Tokudawara does not)', () => {
    const fixture: Scenario = {
      mid: { x: 1.65 * Math.cos((-6 * Math.PI) / 180), y: 1.65 * Math.sin((-6 * Math.PI) / 180) },
      phi: Math.PI,
      counterTick: PUSH_STARTUP_TICKS + 7,
      lateral: 1,
      walkTicks: PUSH_STARTUP_TICKS + 3,
    }
    const circle = runTransition({ ...fixture, arena: { radius: 2.275 } })
    expect(circle.last.cur.outcome).toMatchObject({ kind: 'win', loserId: 'a' })
    const toku = runTransition({ ...fixture, arena: { radius: 2.275, tokudawara: TOKUDAWARA } })
    expect(toku.last.cur.outcome).toEqual({ kind: 'ongoing' })
    expect(toku.ticks.length).toBe(N)
    // the same canonical path (target choice ignores Tokudawara), beyond the circle inside the window
    expect(toku.ticks.slice(0, circle.ticks.length).map((t) => t.cur.participants)).toEqual(
      circle.ticks.map((t) => t.cur.participants),
    )
    expect(Math.max(...toku.ticks.map((t) => radial(A(t.cur).position)))).toBeGreaterThan(2.275)
  })

  it('a decided outcome freezes the deciding-tick state exactly (no completion warp)', () => {
    const { sim, last } = runTransition(COUNTER_USER_OUT)
    const frozen = sim.getSnapshot()
    expect(frozen).toEqual(last.cur)
    for (let k = 0; k < N; k++) {
      sim.step(intents({ move: [1, 1], push: true, grip: true }, { counter: true }))
      expect(sim.getSnapshot()).toEqual(frozen)
    }
    expect(frozen.counterTransition.kind).toBe('active')
  })

  // ---- D2 Kuzushi -----------------------------------------------------------------------------------

  it('D2: the pusher Kuzushi is paused during the transition and renewed to the full KUZUSHI_TICKS', () => {
    const { sim } = catchCounter({ counterTick: SUCCESS_TICK })
    for (let k = 0; k < N; k++) {
      sim.step(IDLE)
      if (k < N - 1) expect(B(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    }
    expect(B(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS })
    expect(A(sim.getSnapshot()).posture).toEqual({ kind: 'stable' })
    sim.step(IDLE)
    expect(B(sim.getSnapshot()).posture).toEqual({ kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS - 1 })
  })

  it('D2: after completion the Counter user can Grip and gets Morozashi; the pusher cannot act', () => {
    const { sim } = catchCounter({ counterTick: 0 })
    for (let k = 0; k < N; k++) sim.step(IDLE)
    sim.step(intents({ grip: true }, { push: true, grip: true }))
    const s = sim.getSnapshot()
    expect(s.engagement).toEqual({ kind: 'grappled', advantage: { kind: 'morozashi', holderId: 'a' } })
  })

  // ---- failed Counter / no target -------------------------------------------------------------------

  it('a failed Counter keeps its Kuzushi-only behavior and never creates a transition', () => {
    const sim = new BoutSimulation(setupOf({}))
    for (let t = 0; t < COUNTER_WINDOW_TICKS + 3; t++) {
      sim.step(intents({ counter: t === 0 }))
      expect(sim.getSnapshot().counterTransition).toEqual({ kind: 'none' })
    }
    expect(A(sim.getSnapshot()).posture.kind).toBe('kuzushi')
  })

  it('no valid target keeps the ACTION-04A2 fallback: no transition, no relocation, finite, no overlap', () => {
    const sim = new BoutSimulation({
      arena: { radius: 1.0 },
      participants: [
        { id: 'a', position: { x: -COMBINED / 2, y: 0 } },
        { id: 'b', position: { x: COMBINED / 2, y: 0 } },
      ],
    })
    let caught = false
    for (let t = 0; t < 60; t++) {
      sim.step(intents({ counter: t === SUCCESS_TICK }, { push: t === 0 }))
      const s = sim.getSnapshot()
      expect(s.counterTransition).toEqual({ kind: 'none' })
      expectFinite(s)
      expect(dist(s)).toBeGreaterThanOrEqual(COMBINED - 1e-9)
      expect(s.outcome).toEqual({ kind: 'ongoing' })
      if (B(s).posture.kind === 'kuzushi') caught = true
    }
    expect(caught).toBe(true)
  })

  // ---- Snapshot -------------------------------------------------------------------------------------

  it('counterTransition is a top-level isolated copy', () => {
    const { sim } = catchCounter()
    const s = sim.getSnapshot()
    expect(Object.keys(s).sort()).toEqual(['arena', 'counterTransition', 'engagement', 'outcome', 'participants'])
    expect(sim.getSnapshot().counterTransition).not.toBe(s.counterTransition)
    ;(s.counterTransition as { ticksRemaining: number }).ticksRemaining = 999
    ;(s.counterTransition as { counterUserId: string }).counterUserId = 'zzz'
    expect(sim.getSnapshot().counterTransition).toMatchObject({ counterUserId: 'a', ticksRemaining: N })
  })

  // ---- symmetry / roles -----------------------------------------------------------------------------

  it('mirrored geometry with swapped participant order gives the mirrored transition', () => {
    const normal = catchCounter({ counterTick: SUCCESS_TICK, lateral: 1 })
    // mirror x -> -x (phi -> PI - phi) flips the side; listing B first must not matter
    const mirrored = catchCounter({ counterTick: SUCCESS_TICK, lateral: -1, phi: Math.PI, swapOrder: true })
    for (let k = 0; k <= N; k++) {
      const n = normal.sim.getSnapshot()
      const m = mirrored.sim.getSnapshot()
      for (const id of ['a', 'b']) {
        expect(byId(m, id).position.x).toBeCloseTo(-byId(n, id).position.x, 9)
        expect(byId(m, id).position.y).toBeCloseTo(byId(n, id).position.y, 9)
      }
      expect(m.counterTransition).toEqual(n.counterTransition)
      normal.sim.step(IDLE)
      mirrored.sim.step(IDLE)
    }
  })

  it('a dummy-driven Push gives the same transition as a scripted one (ownership does not matter)', () => {
    const scripted = new BoutSimulation(setupOf({}))
    const driven = new BoutSimulation(setupOf({}))
    const dummy = new PushDummyController('b', 'a')
    dummy.setMode('push') // in contact and ready: its first intent is the Push edge
    for (let t = 0; t < PUSH_STARTUP_TICKS + 1 + N + 5; t++) {
      const dummyIntent = dummy.nextIntent(driven.getSnapshot())
      expect(dummyIntent.pushPressed).toBe(t === 0)
      scripted.step(intents({ counter: t === 0 }, { push: t === 0 }))
      driven.step(new Map([['a', one({ counter: t === 0 })], ['b', dummyIntent]]))
      expect(driven.getSnapshot()).toEqual(scripted.getSnapshot())
    }
  })
})
