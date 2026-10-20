// Canonical owner of bout runtime state. Pure TypeScript; must not import Phaser.
import type {
  ArenaSetup,
  BoutEngagement,
  BoutOutcome,
  BoutSetup,
  BoutSnapshot,
  CounterTier,
  GrappleAdvantage,
  GripPhase,
  ParticipantId,
  ParticipantActionState,
  ParticipantIntent,
  ParticipantPosture,
  ParticipantState,
  PushPhase,
  Vec2,
} from './BoutTypes.ts'
import { GRAPPLE_TURN_RATE, canActInGrapple, turnFacingTowardGrapple } from './grappleOrientation.ts'
import { resolveArenaRingOut } from './ringOut.ts'

// Provisional technical values for the movement foundation; NOT final balance. Subject to User Play Test.
export const SIMULATION_HZ = 60
export const TICK_SECONDS = 1 / SIMULATION_HZ
export const MAX_SPEED = 3 // m/s
// Grounded movement model (ACTION-02B). Before: ACCELERATION 12, DECELERATION 15, isotropic.
export const FORWARD_ACCELERATION = 10 // m/s^2, speeding up along the desired direction
export const STOP_DECELERATION = 24 // m/s^2, braking with no input (and when over the target speed)
export const LATERAL_DECELERATION = 36 // m/s^2, damping of velocity perpendicular to the desired direction
export const REVERSE_BRAKING = 30 // m/s^2, killing velocity that opposes the desired direction

// Gameplay body geometry (provisional; equal for both participants, not final rikishi size).
export const BODY_RADIUS = 0.35 // m
// Contact is detected within this distance of touching, so resting contact does not flicker.
export const CONTACT_SLOP = 0.002 // m

// Discrete Push (ACTION-03B). Provisional Prototype tuning, subject to User Play Test.
export const PUSH_STARTUP_TICKS = 6 // ~100 ms: steering suppressed, braking, no force yet
export const PUSH_ACTIVE_TICKS = 8 // ~133 ms: short locked drive; pushes only while in contact
export const PUSH_RECOVERY_TICKS = 10 // ~167 ms: steering suppressed, braking, no force
// Pair acceleration along the contact normal per net active Push (+1 / -1).
export const PUSH_EXTERNAL_ACCELERATION = 20 // m/s^2
// External (received) momentum decays toward zero independently of grounded footwork damping.
export const EXTERNAL_DECELERATION = 8 // m/s^2
export const MAX_EXTERNAL_SPEED = 3 // m/s

// Down Counter + Kuzushi (ACTION-04A1). Provisional Prototype tuning, subject to User Play Test.
export const COUNTER_WINDOW_TICKS = 12 // ~200 ms: waits for an opponent active Push in contact
// A Counter catching the first COUNTER_BEST_TICKS active Push ticks (elapsed 0..2) is Best.
export const COUNTER_BEST_TICKS = 3
export const KUZUSHI_TICKS = 30 // ~500 ms of full Kuzushi ticks (countered attacker and failed Counter)
// Received Push acceleration multiplier while the driven-back participant is in Kuzushi.
export const KUZUSHI_PUSH_SUSCEPTIBILITY = 1.5
// Counter position resolution (ACTION-04A2). Provisional Prototype tuning.
// Attacker-only forward carry along its locked Push direction on a successful Counter.
export const COUNTER_OVERSHOOT_SPEED = 1.0 // m/s
// Lateral offsets within this (m) count as a tie when choosing the side.
export const COUNTER_SIDE_EPSILON = 1e-6

// Grip / Engagement (ACTION-05A). Provisional Prototype tuning, subject to User Play Test.
export const GRIP_REACH_TICKS = 6 // ~100 ms: waits for an in-range idle target
export const GRIP_RECOVERY_TICKS = 12 // ~200 ms after a whiffed Grip or a release
// Grip range = combined radius + this margin (m). Kuzushi never bypasses it.
export const GRIP_RANGE_MARGIN = 0.09

// Grappled Drive (ACTION-05C1). Provisional Prototype tuning, subject to User Play Test.
export const GRAPPLE_DRIVE_SPEED = 0.6 // m/s pair target speed per unit of net Drive strength
export const GRAPPLE_DRIVE_ACCELERATION = 4 // m/s^2 toward that target per unit of net strength
export const MOROZASHI_DRIVE_FACTOR = 1.5 // Morozashi holder's Drive strength (others 1)

// Inward self-velocity sums at or below this (m/s) count as no contribution.
const INWARD_EPSILON = 1e-9

// Below this center distance the contact normal is undefined and a fallback is used.
const MIN_CONTACT_DISTANCE = 1e-9

type MutableVec2 = { x: number; y: number }

type MutableAction =
  | { kind: 'idle' }
  | { kind: 'push'; phase: PushPhase; ticksRemaining: number; direction: MutableVec2 }
  | { kind: 'counter'; ticksRemaining: number }
  | { kind: 'grip'; phase: GripPhase; ticksRemaining: number }
  | { kind: 'drive' }

type MutablePosture = { kind: 'stable' } | { kind: 'kuzushi'; ticksRemaining: number }

interface MutableParticipant {
  id: string
  position: MutableVec2
  // Own footwork; the grounded movement rule and contact closing removal apply only here.
  selfVelocity: MutableVec2
  // Momentum induced by the opponent Push; decays on its own. Displacement uses self + external.
  externalVelocity: MutableVec2
  action: MutableAction
  // Invariant: kuzushi => action is idle (entered only through enterKuzushi).
  posture: MutablePosture
  facing: number
  bodyRadius: number
}

interface ContactResult {
  readonly nx: number
  readonly ny: number
}

const ZERO_MOVE: Vec2 = { x: 0, y: 0 }

function nextPushPhase(phase: PushPhase): { phase: PushPhase; ticks: number } | null {
  if (phase === 'startup') return { phase: 'active', ticks: PUSH_ACTIVE_TICKS }
  if (phase === 'active') return { phase: 'recovery', ticks: PUSH_RECOVERY_TICKS }
  return null
}

// Effective self-movement intent: free steering only while idle and stable. Kuzushi, Counter and Grip
// brake (zero intent); Push owns movement during its phases. Grappled steering is handled by the caller.
function effectiveMove(p: MutableParticipant, move: Vec2): Vec2 {
  if (p.posture.kind === 'kuzushi') return ZERO_MOVE
  if (p.action.kind === 'idle') return move
  if (p.action.kind === 'counter' || p.action.kind === 'grip' || p.action.kind === 'drive') return ZERO_MOVE
  return p.action.phase === 'active' ? p.action.direction : ZERO_MOVE
}

function isGripReaching(p: MutableParticipant): boolean {
  return p.action.kind === 'grip' && p.action.phase === 'reach'
}

// Drive strength of one participant: the Morozashi holder drives harder; everyone else is 1.
export function grappleDriveStrength(engagement: BoutEngagement, id: ParticipantId): number {
  return engagement.kind === 'grappled' &&
    engagement.advantage.kind === 'morozashi' &&
    engagement.advantage.holderId === id
    ? MOROZASHI_DRIVE_FACTOR
    : 1
}

// One grappled update of the pair's shared external velocity `v` for signed net Drive `net` along
// the pair axis `n` (A -> B). net = 0: the existing external decay. Otherwise the axial component
// accelerates toward GRAPPLE_DRIVE_SPEED*|net| at GRAPPLE_DRIVE_ACCELERATION*|net| without the
// axial decay being subtracted first (that would cancel a 4 m/s^2 Drive against the 8 m/s^2 decay);
// beyond the target it bleeds back by EXTERNAL_DECELERATION. Opposing axial momentum is cancelled by
// the Drive acceleration; the perpendicular part decays as usual. Then the existing MAX clamp.
export function grappledExternalVelocity(v: Vec2, n: Vec2, net: number): Vec2 {
  const out: MutableVec2 = { x: v.x, y: v.y }
  if (net === 0) {
    decayExternal(out)
    return out
  }
  const strength = Math.abs(net)
  const dirX = Math.sign(net) * n.x
  const dirY = Math.sign(net) * n.y
  let parallel = v.x * dirX + v.y * dirY
  const perp: MutableVec2 = { x: v.x - parallel * dirX, y: v.y - parallel * dirY }
  const target = GRAPPLE_DRIVE_SPEED * strength
  if (parallel < target) {
    parallel = Math.min(target, parallel + GRAPPLE_DRIVE_ACCELERATION * strength * TICK_SECONDS)
  } else {
    parallel = Math.max(target, parallel - EXTERNAL_DECELERATION * TICK_SECONDS)
  }
  decayExternal(perp)
  out.x = parallel * dirX + perp.x
  out.y = parallel * dirY + perp.y
  clampExternal(out)
  return out
}

function copyOutcome(outcome: BoutOutcome): BoutOutcome {
  if (outcome.kind === 'ongoing') return { kind: 'ongoing' }
  if (outcome.kind === 'rematch') return { kind: 'rematch', reason: outcome.reason }
  return { kind: 'win', winnerId: outcome.winnerId, loserId: outcome.loserId, reason: outcome.reason }
}

function copyEngagement(engagement: BoutEngagement): BoutEngagement {
  if (engagement.kind === 'free') return { kind: 'free' }
  const advantage: GrappleAdvantage =
    engagement.advantage.kind === 'neutral'
      ? { kind: 'neutral' }
      : { kind: 'morozashi', holderId: engagement.advantage.holderId }
  return { kind: 'grappled', advantage }
}

// Tier of a Counter that catches an active Push, from the Push's active ticks remaining.
// ACTION-04A1: Best and Success share the same result; positional outcomes come later.
export function counterTier(pushActiveTicksRemaining: number): Exclude<CounterTier, 'fail'> {
  const activeElapsed = PUSH_ACTIVE_TICKS - pushActiveTicksRemaining
  return activeElapsed < COUNTER_BEST_TICKS ? 'best' : 'success'
}

// Where a successful Counter puts the defender, or null to stay put. Basis: attacker center `p` and
// its locked Push direction `d`; candidates sit at exact contact distance `combined` (no overlap):
//   rear = p - d*R, side+ = p + perp*R, side- = p - perp*R  with perp = (-d.y, d.x).
// Side preference: the side the defender already leans to (sign of its lateral offset); on a tie the
// side nearer the ring center, then side+. Best tries rear first. The first valid candidate wins;
// a candidate is valid only if the defender body fits fully inside the ring (never clamped).
export function counterRelocationTarget(
  tier: Exclude<CounterTier, 'fail'>,
  p: Vec2,
  d: Vec2,
  combined: number,
  defenderPosition: Vec2,
  maxCenterDistance: number,
): Vec2 | null {
  const perpX = -d.y
  const perpY = d.x
  const sidePlus = { x: p.x + perpX * combined, y: p.y + perpY * combined }
  const sideMinus = { x: p.x - perpX * combined, y: p.y - perpY * combined }
  const lateralOffset = perpX * (defenderPosition.x - p.x) + perpY * (defenderPosition.y - p.y)

  let sides: Vec2[]
  if (lateralOffset > COUNTER_SIDE_EPSILON) sides = [sidePlus, sideMinus]
  else if (lateralOffset < -COUNTER_SIDE_EPSILON) sides = [sideMinus, sidePlus]
  else {
    const plusFromCenter = Math.hypot(sidePlus.x, sidePlus.y)
    const minusFromCenter = Math.hypot(sideMinus.x, sideMinus.y)
    sides = minusFromCenter < plusFromCenter - COUNTER_SIDE_EPSILON ? [sideMinus, sidePlus] : [sidePlus, sideMinus]
  }
  const candidates =
    tier === 'best' ? [{ x: p.x - d.x * combined, y: p.y - d.y * combined }, ...sides] : sides

  const isValid = (c: Vec2) =>
    Number.isFinite(c.x) && Number.isFinite(c.y) && Math.hypot(c.x, c.y) <= maxCenterDistance
  return candidates.find(isValid) ?? null
}

// The only entry into Kuzushi: cancels the current action, so nothing chosen earlier carries over.
function enterKuzushi(p: MutableParticipant): void {
  p.action = { kind: 'idle' }
  p.posture = { kind: 'kuzushi', ticksRemaining: KUZUSHI_TICKS }
}

// Runs at the start of a tick: an expired Kuzushi becomes stable before input is read; otherwise
// this tick is spent as one full Kuzushi tick. A Kuzushi entered later in a tick is not counted yet.
function advancePosture(p: MutableParticipant): void {
  if (p.posture.kind !== 'kuzushi') return
  if (p.posture.ticksRemaining <= 0) p.posture = { kind: 'stable' }
  else p.posture.ticksRemaining -= 1
}

// Brakes external momentum toward exact zero (no reversal).
function decayExternal(v: MutableVec2): void {
  const speed = Math.hypot(v.x, v.y)
  const drop = EXTERNAL_DECELERATION * TICK_SECONDS
  if (speed <= drop) {
    v.x = 0
    v.y = 0
    return
  }
  const scale = (speed - drop) / speed
  v.x *= scale
  v.y *= scale
}

function clampExternal(v: MutableVec2): void {
  const speed = Math.hypot(v.x, v.y)
  if (speed > MAX_EXTERNAL_SPEED) {
    v.x *= MAX_EXTERNAL_SPEED / speed
    v.y *= MAX_EXTERNAL_SPEED / speed
  }
}

function isPushActive(p: MutableParticipant): boolean {
  return p.action.kind === 'push' && p.action.phase === 'active'
}

function copyAction(action: MutableAction): ParticipantActionState {
  if (action.kind === 'idle') return { kind: 'idle' }
  if (action.kind === 'counter') return { kind: 'counter', ticksRemaining: action.ticksRemaining }
  if (action.kind === 'grip') {
    return { kind: 'grip', phase: action.phase, ticksRemaining: action.ticksRemaining }
  }
  if (action.kind === 'drive') return { kind: 'drive' }
  return {
    kind: 'push',
    phase: action.phase,
    ticksRemaining: action.ticksRemaining,
    direction: { x: action.direction.x, y: action.direction.y },
  }
}

function copyPosture(posture: MutablePosture): ParticipantPosture {
  if (posture.kind === 'stable') return { kind: 'stable' }
  return { kind: 'kuzushi', ticksRemaining: posture.ticksRemaining }
}

// Simulation-owned deep copy (no `tokudawara` key for a plain circle).
function copyArena(arena: ArenaSetup): ArenaSetup {
  const t = arena.tokudawara
  return t ? { radius: arena.radius, tokudawara: { depth: t.depth, halfAngle: t.halfAngle } } : { radius: arena.radius }
}

function assertValidArena(arena: ArenaSetup): void {
  if (!Number.isFinite(arena.radius) || arena.radius <= 0) {
    throw new Error('Invalid BoutSetup: arena.radius must be a positive finite number')
  }
  const t = arena.tokudawara
  if (t === undefined) return
  if (!Number.isFinite(t.depth) || t.depth <= 0) {
    throw new Error('Invalid BoutSetup: arena.tokudawara.depth must be a positive finite number')
  }
  if (!Number.isFinite(t.halfAngle) || t.halfAngle <= 0 || t.halfAngle >= Math.PI / 4) {
    throw new Error('Invalid BoutSetup: arena.tokudawara.halfAngle must be within (0, pi/4)')
  }
}

function assertFiniteVec2(v: Vec2, label: string): void {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    throw new Error(`Invalid BoutSetup: ${label} must be finite`)
  }
}

// Non-finite input is treated as no input; length is clamped to at most 1.
function sanitizeMove(move: Vec2): MutableVec2 {
  if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) return { x: 0, y: 0 }
  const length = Math.hypot(move.x, move.y)
  if (length > 1) return { x: move.x / length, y: move.y / length }
  return { x: move.x, y: move.y }
}

// Updates velocity in place for one tick. Velocity is split along the desired direction d:
//  - perpendicular part: damped strongly (feet re-plant instead of sliding in an arc)
//  - parallel part: opposing -> braked to zero first; same direction -> accelerates up to the
//    target speed; above target -> braked
// With no input the whole velocity brakes to exact zero.
function applyGroundedVelocity(v: MutableVec2, move: Vec2): void {
  const inputLength = Math.hypot(move.x, move.y)
  if (inputLength === 0) {
    const speed = Math.hypot(v.x, v.y)
    const drop = STOP_DECELERATION * TICK_SECONDS
    if (speed <= drop) {
      v.x = 0
      v.y = 0
    } else {
      const scale = (speed - drop) / speed
      v.x *= scale
      v.y *= scale
    }
    return
  }

  const dirX = move.x / inputLength
  const dirY = move.y / inputLength
  const targetSpeed = inputLength * MAX_SPEED

  let parallel = v.x * dirX + v.y * dirY
  let perpX = v.x - parallel * dirX
  let perpY = v.y - parallel * dirY

  const perpSpeed = Math.hypot(perpX, perpY)
  const perpDrop = LATERAL_DECELERATION * TICK_SECONDS
  if (perpSpeed <= perpDrop) {
    perpX = 0
    perpY = 0
  } else {
    const scale = (perpSpeed - perpDrop) / perpSpeed
    perpX *= scale
    perpY *= scale
  }

  if (parallel < 0) {
    parallel = Math.min(0, parallel + REVERSE_BRAKING * TICK_SECONDS)
  } else if (parallel < targetSpeed) {
    parallel = Math.min(targetSpeed, parallel + FORWARD_ACCELERATION * TICK_SECONDS)
  } else {
    parallel = Math.max(targetSpeed, parallel - STOP_DECELERATION * TICK_SECONDS)
  }

  v.x = parallel * dirX + perpX
  v.y = parallel * dirY + perpY

  // Parallel and perpendicular parts can add up to slightly more than MAX_SPEED while turning.
  const speed = Math.hypot(v.x, v.y)
  if (speed > MAX_SPEED) {
    v.x *= MAX_SPEED / speed
    v.y *= MAX_SPEED / speed
  }
}

// Direction from `from` toward `to`, or `fallback` when the points coincide.
function facingToward(from: Vec2, to: Vec2, fallback: number): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  return Math.atan2(dy, dx)
}

export class BoutSimulation {
  private readonly arena: ArenaSetup
  private readonly participants: MutableParticipant[]
  // Pair relationship; the only place grappling is recorded (participants carry no grapple flags).
  private engagement: BoutEngagement = { kind: 'free' }
  // Bout result; the only place winner / loser / rematch is recorded.
  private outcome: BoutOutcome = { kind: 'ongoing' }

  constructor(setup: BoutSetup) {
    assertValidArena(setup.arena)
    if (setup.participants.length !== 2) {
      throw new Error('Invalid BoutSetup: exactly 2 participants are required')
    }
    const ids = new Set<string>()
    for (const p of setup.participants) {
      if (p.id === '') throw new Error('Invalid BoutSetup: participant id must not be empty')
      if (ids.has(p.id)) throw new Error(`Invalid BoutSetup: duplicate participant id "${p.id}"`)
      ids.add(p.id)
      assertFiniteVec2(p.position, `participant "${p.id}" position`)
    }

    // Copy so the caller setup object is never aliased as canonical state.
    this.arena = copyArena(setup.arena)
    this.participants = setup.participants.map((p) => ({
      id: p.id,
      position: { x: p.position.x, y: p.position.y },
      selfVelocity: { x: 0, y: 0 },
      externalVelocity: { x: 0, y: 0 },
      action: { kind: 'idle' },
      posture: { kind: 'stable' },
      facing: 0,
      bodyRadius: BODY_RADIUS,
    }))
    this.updateFacing()
  }

  // Advances exactly one logical tick (TICK_SECONDS). Participants without an intent have zero move.
  // Order: posture timers -> tick-start grapple readiness -> release (if the tick began grappled) ->
  // FREE action start / grappled Drive decision -> effective move -> grounded self velocity ->
  // external update (FREE decay / grappled shared Drive update) -> integrate (self + external) ->
  // contact -> grapple bond (grappled) -> Counter / Grip / Push resolution (free) -> action timers ->
  // facing -> ring-out (once, from the previous and final resolved centers).
  // Once the outcome is decided the bout is frozen: step() is an exact no-op.
  step(intents: ReadonlyMap<ParticipantId, ParticipantIntent>): void {
    if (this.outcome.kind !== 'ongoing') return
    const [a, b] = this.participants
    const previousA: Vec2 = { x: a.position.x, y: a.position.y }
    const previousB: Vec2 = { x: b.position.x, y: b.position.y }

    for (const p of this.participants) advancePosture(p)

    // Readiness from the state at tick start (the previous Snapshot), used by release and Drive.
    const startEngagement = this.engagement
    const ready = (p: MutableParticipant) => canActInGrapple(p, p === a ? b : a, startEngagement)

    // While grappled a Grip edge releases, but only from a READY participant; a TURNING participant's
    // edge is ignored, not queued. Release wins over Drive: every Drive action ends, releasing
    // participants enter Grip Recovery, and nobody starts a FREE action on the release tick.
    let released = false
    if (this.engagement.kind === 'grappled') {
      const releasers = this.participants.filter((p) => intents.get(p.id)?.gripPressed === true && ready(p))
      if (releasers.length > 0) {
        this.engagement = { kind: 'free' }
        for (const p of this.participants) if (p.action.kind === 'drive') p.action = { kind: 'idle' }
        for (const p of releasers) p.action = { kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS }
        released = true
      }
    }
    const grappled = this.engagement.kind === 'grappled'

    // Grappled Drive: a READY participant holding Drive contributes this tick (timerless action).
    if (grappled) {
      for (const p of this.participants) {
        p.action = intents.get(p.id)?.driveHeld === true && ready(p) ? { kind: 'drive' } : { kind: 'idle' }
      }
    }

    for (const p of this.participants) {
      const intent = intents.get(p.id)
      const move = sanitizeMove(intent?.move ?? ZERO_MOVE)

      // FREE actions start only from idle + stable; presses during an action or Kuzushi are ignored
      // (not queued). Same-tick priority: Push > Counter > Grip; the losing edges are dropped.
      if (!grappled && !released && p.action.kind === 'idle' && p.posture.kind === 'stable') {
        if (intent?.pushPressed === true) {
          p.action = {
            kind: 'push',
            phase: 'startup',
            ticksRemaining: PUSH_STARTUP_TICKS,
            direction: { x: Math.cos(p.facing), y: Math.sin(p.facing) },
          }
        } else if (intent?.counterPressed === true) {
          p.action = { kind: 'counter', ticksRemaining: COUNTER_WINDOW_TICKS }
        } else if (intent?.gripPressed === true) {
          p.action = { kind: 'grip', phase: 'reach', ticksRemaining: GRIP_REACH_TICKS }
        }
      }

      // Grappled: ordinary WASD is suppressed for both (no grappled footwork yet).
      applyGroundedVelocity(p.selfVelocity, grappled ? ZERO_MOVE : effectiveMove(p, move))
      if (!grappled) decayExternal(p.externalVelocity)
    }
    if (grappled) this.updateGrappledExternal()

    for (const p of this.participants) {
      p.position.x += (p.selfVelocity.x + p.externalVelocity.x) * TICK_SECONDS
      p.position.y += (p.selfVelocity.y + p.externalVelocity.y) * TICK_SECONDS
    }
    const contact = this.resolveContact()
    if (grappled) {
      this.resolveGrappleBond()
    } else {
      if (contact) this.resolveCounter()
      this.resolveGrip()
      if (contact && this.engagement.kind === 'free') this.resolvePush(contact)
    }
    for (const p of this.participants) this.advanceAction(p)
    this.updateFacing()

    // After every positional change of the tick; the final physical state is kept as-is.
    this.outcome = resolveArenaRingOut(
      [
        { id: a.id, previous: previousA, current: a.position },
        { id: b.id, previous: previousB, current: b.position },
      ],
      this.arena,
    )
  }

  // Returns a fresh copy; mutating it never affects canonical state.
  getSnapshot(): BoutSnapshot {
    return {
      arena: copyArena(this.arena),
      participants: this.participants.map(
        (p): ParticipantState => ({
          id: p.id,
          position: { x: p.position.x, y: p.position.y },
          velocity: {
            x: p.selfVelocity.x + p.externalVelocity.x,
            y: p.selfVelocity.y + p.externalVelocity.y,
          },
          externalVelocity: { x: p.externalVelocity.x, y: p.externalVelocity.y },
          action: copyAction(p.action),
          posture: copyPosture(p.posture),
          facing: p.facing,
          bodyRadius: p.bodyRadius,
        }),
      ),
      engagement: copyEngagement(this.engagement),
      outcome: copyOutcome(this.outcome),
    }
  }

  // FREE Grip: a reaching, stable participant grips an action-idle opponent within
  // combined radius + GRIP_RANGE_MARGIN (never interrupting a Push / Counter / Grip). A Kuzushi target
  // gives Morozashi to the gripper. Both reaching and in range on the same tick: neutral (symmetric).
  private resolveGrip(): void {
    if (this.engagement.kind !== 'free') return
    const [a, b] = this.participants
    const distance = Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
    if (distance > a.bodyRadius + b.bodyRadius + GRIP_RANGE_MARGIN) return

    const canGrip = (p: MutableParticipant) => isGripReaching(p) && p.posture.kind === 'stable'
    if (canGrip(a) && canGrip(b)) {
      this.enterGrapple({ kind: 'neutral' })
      return
    }
    for (const [gripper, target] of [
      [a, b],
      [b, a],
    ]) {
      if (!canGrip(gripper) || target.action.kind !== 'idle') continue
      if (target.posture.kind === 'kuzushi') {
        target.posture = { kind: 'stable' } // Kuzushi is consumed; the advantage lives in the engagement
        this.enterGrapple({ kind: 'morozashi', holderId: gripper.id })
      } else {
        this.enterGrapple({ kind: 'neutral' })
      }
      return
    }
  }

  // The only entry into a grapple: both actions end, the pair shares the average external momentum
  // (equal-body Prototype normalization, not mass physics), and the centers attach at contact distance.
  private enterGrapple(advantage: GrappleAdvantage): void {
    const [a, b] = this.participants
    this.engagement = { kind: 'grappled', advantage }
    a.action = { kind: 'idle' }
    b.action = { kind: 'idle' }
    const avgX = (a.externalVelocity.x + b.externalVelocity.x) / 2
    const avgY = (a.externalVelocity.y + b.externalVelocity.y) / 2
    for (const p of this.participants) {
      p.externalVelocity.x = avgX
      p.externalVelocity.y = avgY
    }
    this.resolveGrappleBond()
  }

  // Grappled pair: one shared external update per tick along the tick-start pair axis (A -> B), with
  // the signed, order-independent net Drive strength(A)*[A drives] - strength(B)*[B drives]. Both
  // participants end with the identical external velocity, so the bonded pair moves as one.
  private updateGrappledExternal(): void {
    const [a, b] = this.participants
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const distance = Math.hypot(dx, dy)
    const n =
      distance > MIN_CONTACT_DISTANCE
        ? { x: dx / distance, y: dy / distance }
        : { x: Math.cos(a.facing), y: Math.sin(a.facing) }
    const net =
      (a.action.kind === 'drive' ? grappleDriveStrength(this.engagement, a.id) : 0) -
      (b.action.kind === 'drive' ? grappleDriveStrength(this.engagement, b.id) : 0)
    const shared = {
      x: (a.externalVelocity.x + b.externalVelocity.x) / 2,
      y: (a.externalVelocity.y + b.externalVelocity.y) / 2,
    }
    const next = grappledExternalVelocity(shared, n, net)
    for (const p of this.participants) {
      p.externalVelocity.x = next.x
      p.externalVelocity.y = next.y
    }
  }

  // Grapple bond: moves both centers symmetrically along their axis so the distance is exactly the
  // combined radius (the smallest radial rule; no constraint solver). Same-center fallback: A's facing.
  private resolveGrappleBond(): void {
    const [a, b] = this.participants
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const distance = Math.hypot(dx, dy)
    let nx: number
    let ny: number
    if (distance > MIN_CONTACT_DISTANCE) {
      nx = dx / distance
      ny = dy / distance
    } else {
      nx = Math.cos(a.facing)
      ny = Math.sin(a.facing)
    }
    const half = (distance - (a.bodyRadius + b.bodyRadius)) / 2
    a.position.x += nx * half
    a.position.y += ny * half
    b.position.x -= nx * half
    b.position.y -= ny * half
  }

  // Two-circle contact: removes the closing normal self velocity (tangential kept) and separates any
  // overlap, assigning the correction by each participant's inward contribution (no mass weighting).
  // Only self velocity counts: external momentum is shared by the pair and is never treated as
  // footwork. Returns the contact normal (A -> B) when in contact, otherwise null.
  private resolveContact(): ContactResult | null {
    const [a, b] = this.participants
    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const distance = Math.hypot(dx, dy)
    const combined = a.bodyRadius + b.bodyRadius
    if (distance > combined + CONTACT_SLOP) return null

    // Normal A -> B. Same-center fallback: A's facing, which is always finite.
    let nx: number
    let ny: number
    if (distance > MIN_CONTACT_DISTANCE) {
      nx = dx / distance
      ny = dy / distance
    } else {
      nx = Math.cos(a.facing)
      ny = Math.sin(a.facing)
    }

    // Inward contributions are captured before the closing velocity is removed; they decide who
    // "caused" the penetration and therefore who is moved back.
    const inwardA = Math.max(0, a.selfVelocity.x * nx + a.selfVelocity.y * ny) // A moving toward B
    const inwardB = Math.max(0, -(b.selfVelocity.x * nx + b.selfVelocity.y * ny)) // B moving toward A
    if (inwardA > 0) {
      a.selfVelocity.x -= inwardA * nx
      a.selfVelocity.y -= inwardA * ny
    }
    if (inwardB > 0) {
      b.selfVelocity.x += inwardB * nx
      b.selfVelocity.y += inwardB * ny
    }

    if (distance < combined) {
      const overlap = combined - distance
      // Share of the correction applied to A. Only the participant moving inward is moved back, so a
      // stationary body is never displaced (no implicit positional push). With no meaningful inward
      // contribution (setup overlap, same center) fall back to an even split.
      const inwardSum = inwardA + inwardB
      let shareA = 0.5
      if (inwardSum > INWARD_EPSILON) {
        shareA = inwardA / inwardSum
      } else {
        // Overlap without inward motion (e.g. curvature while circling): still never displace a
        // body that is not moving. Even split only when both or neither are moving.
        const aMoving = Math.hypot(a.selfVelocity.x, a.selfVelocity.y) > INWARD_EPSILON
        const bMoving = Math.hypot(b.selfVelocity.x, b.selfVelocity.y) > INWARD_EPSILON
        if (aMoving && !bMoving) shareA = 1
        else if (bMoving && !aMoving) shareA = 0
      }
      a.position.x -= nx * overlap * shareA
      a.position.y -= ny * overlap * shareA
      b.position.x += nx * overlap * (1 - shareA)
      b.position.y += ny * overlap * (1 - shareA)
    }
    return { nx, ny }
  }

  // In contact, a Counter window catching an active opponent Push succeeds: the attacker's Push is
  // cancelled into Kuzushi before this tick's Push force, and the defender returns to idle.
  // Best puts the defender behind the attacker, Success at its side (counterRelocationTarget), and the
  // attacker alone gets a forward carry along its locked Push direction. Existing external momentum
  // is kept. Returns the tier, or null.
  private resolveCounter(): CounterTier | null {
    const [a, b] = this.participants
    for (const [defender, attacker] of [
      [a, b],
      [b, a],
    ]) {
      if (defender.action.kind !== 'counter') continue
      if (attacker.action.kind !== 'push' || attacker.action.phase !== 'active') continue
      // Captured before enterKuzushi cancels the Push.
      const d: Vec2 = { x: attacker.action.direction.x, y: attacker.action.direction.y }
      const tier = counterTier(attacker.action.ticksRemaining)
      const target = counterRelocationTarget(
        tier,
        attacker.position,
        d,
        attacker.bodyRadius + defender.bodyRadius,
        defender.position,
        this.arena.radius - defender.bodyRadius,
      )
      enterKuzushi(attacker)
      defender.action = { kind: 'idle' }
      if (target) {
        defender.position.x = target.x
        defender.position.y = target.y
      }
      attacker.externalVelocity.x += d.x * COUNTER_OVERSHOOT_SPEED
      attacker.externalVelocity.y += d.y * COUNTER_OVERSHOOT_SPEED
      clampExternal(attacker.externalVelocity)
      return tier
    }
    return null
  }

  // Active Pushes in contact: +1 for A along A->B, -1 for B. The same external velocity delta goes
  // to both participants so the pair moves together; equal Pushes cancel. A driven-back participant
  // in Kuzushi receives KUZUSHI_PUSH_SUSCEPTIBILITY times the acceleration.
  private resolvePush(contact: ContactResult): void {
    const [a, b] = this.participants
    const net = (isPushActive(a) ? 1 : 0) - (isPushActive(b) ? 1 : 0)
    if (net === 0) return
    const receiver = net > 0 ? b : a
    const susceptibility = receiver.posture.kind === 'kuzushi' ? KUZUSHI_PUSH_SUSCEPTIBILITY : 1
    const dv = net * PUSH_EXTERNAL_ACCELERATION * susceptibility * TICK_SECONDS
    for (const p of this.participants) {
      p.externalVelocity.x += contact.nx * dv
      p.externalVelocity.y += contact.ny * dv
      clampExternal(p.externalVelocity)
    }
  }

  // Counts down the current action. Push: startup -> active -> recovery -> idle. Counter: an
  // expired window is a failed Counter and the user enters Kuzushi.
  private advanceAction(p: MutableParticipant): void {
    if (p.action.kind === 'counter') {
      p.action.ticksRemaining -= 1
      if (p.action.ticksRemaining <= 0) enterKuzushi(p)
      return
    }
    // Grip: a reach that expires is a whiff (no Kuzushi penalty) -> recovery -> idle.
    if (p.action.kind === 'grip') {
      p.action.ticksRemaining -= 1
      if (p.action.ticksRemaining > 0) return
      if (p.action.phase === 'reach') {
        p.action = { kind: 'grip', phase: 'recovery', ticksRemaining: GRIP_RECOVERY_TICKS }
      } else {
        p.action = { kind: 'idle' }
      }
      return
    }
    if (p.action.kind !== 'push') return
    p.action.ticksRemaining -= 1
    if (p.action.ticksRemaining > 0) return
    const next = nextPushPhase(p.action.phase)
    if (next) {
      p.action.phase = next.phase
      p.action.ticksRemaining = next.ticks
    } else {
      p.action = { kind: 'idle' }
    }
  }

  // FREE: each participant faces the other instantly; keeps the previous facing if positions coincide.
  // A participant in Kuzushi keeps its facing fixed (side / back exposure stays readable).
  // GRAPPLED: each turns toward the other at GRAPPLE_TURN_RATE (facing only; positions untouched), so
  // a side / rear grip leaves the victim TURNING until it actually faces its opponent.
  private updateFacing(): void {
    const [a, b] = this.participants
    if (this.engagement.kind === 'grappled') {
      const maxTurn = GRAPPLE_TURN_RATE * TICK_SECONDS
      const nextA = turnFacingTowardGrapple(a.position, a.facing, b.position, maxTurn)
      const nextB = turnFacingTowardGrapple(b.position, b.facing, a.position, maxTurn)
      a.facing = nextA
      b.facing = nextB
      return
    }
    if (a.posture.kind !== 'kuzushi') a.facing = facingToward(a.position, b.position, a.facing)
    if (b.posture.kind !== 'kuzushi') b.facing = facingToward(b.position, a.position, b.facing)
  }
}
