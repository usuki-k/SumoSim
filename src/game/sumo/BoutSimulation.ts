// Canonical owner of bout runtime state. Pure TypeScript; must not import Phaser.
import type {
  ArenaSetup,
  BoutSetup,
  BoutSnapshot,
  ParticipantId,
  ParticipantActionState,
  ParticipantIntent,
  ParticipantState,
  PushPhase,
  Vec2,
} from './BoutTypes.ts'

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

// Inward self-velocity sums at or below this (m/s) count as no contribution.
const INWARD_EPSILON = 1e-9

// Below this center distance the contact normal is undefined and a fallback is used.
const MIN_CONTACT_DISTANCE = 1e-9

type MutableVec2 = { x: number; y: number }

type MutableAction =
  | { kind: 'idle' }
  | { kind: 'push'; phase: PushPhase; ticksRemaining: number; direction: MutableVec2 }

interface MutableParticipant {
  id: string
  position: MutableVec2
  // Own footwork; the grounded movement rule and contact closing removal apply only here.
  selfVelocity: MutableVec2
  // Momentum induced by the opponent Push; decays on its own. Displacement uses self + external.
  externalVelocity: MutableVec2
  action: MutableAction
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

// Effective self-movement intent: free steering only while idle; Push owns movement otherwise.
function effectiveMove(action: MutableAction, move: Vec2): Vec2 {
  if (action.kind === 'idle') return move
  return action.phase === 'active' ? action.direction : ZERO_MOVE
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
  return {
    kind: 'push',
    phase: action.phase,
    ticksRemaining: action.ticksRemaining,
    direction: { x: action.direction.x, y: action.direction.y },
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

  constructor(setup: BoutSetup) {
    if (!Number.isFinite(setup.arena.radius) || setup.arena.radius <= 0) {
      throw new Error('Invalid BoutSetup: arena.radius must be a positive finite number')
    }
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
    this.arena = { radius: setup.arena.radius }
    this.participants = setup.participants.map((p) => ({
      id: p.id,
      position: { x: p.position.x, y: p.position.y },
      selfVelocity: { x: 0, y: 0 },
      externalVelocity: { x: 0, y: 0 },
      action: { kind: 'idle' },
      facing: 0,
      bodyRadius: BODY_RADIUS,
    }))
    this.updateFacing()
  }

  // Advances exactly one logical tick (TICK_SECONDS). Participants without an intent have zero move.
  // Order: intent -> Push start -> effective move -> grounded self velocity -> external decay ->
  // integrate (self + external) -> contact -> Push resolution -> Push timers -> facing.
  step(intents: ReadonlyMap<ParticipantId, ParticipantIntent>): void {
    for (const p of this.participants) {
      const intent = intents.get(p.id)
      const move = sanitizeMove(intent?.move ?? ZERO_MOVE)

      // A Push starts only from idle; presses during an action are ignored (not queued).
      if (intent?.pushPressed === true && p.action.kind === 'idle') {
        p.action = {
          kind: 'push',
          phase: 'startup',
          ticksRemaining: PUSH_STARTUP_TICKS,
          direction: { x: Math.cos(p.facing), y: Math.sin(p.facing) },
        }
      }

      applyGroundedVelocity(p.selfVelocity, effectiveMove(p.action, move))
      decayExternal(p.externalVelocity)

      p.position.x += (p.selfVelocity.x + p.externalVelocity.x) * TICK_SECONDS
      p.position.y += (p.selfVelocity.y + p.externalVelocity.y) * TICK_SECONDS
    }
    const contact = this.resolveContact()
    if (contact) this.resolvePush(contact)
    for (const p of this.participants) this.advanceAction(p)
    this.updateFacing()
  }

  // Returns a fresh copy; mutating it never affects canonical state.
  getSnapshot(): BoutSnapshot {
    return {
      arena: { radius: this.arena.radius },
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
          facing: p.facing,
          bodyRadius: p.bodyRadius,
        }),
      ),
    }
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

  // Active Pushes in contact: +1 for A along A->B, -1 for B. The same external velocity delta goes
  // to both participants so the pair moves together; equal Pushes cancel.
  private resolvePush(contact: ContactResult): void {
    const [a, b] = this.participants
    const net = (isPushActive(a) ? 1 : 0) - (isPushActive(b) ? 1 : 0)
    if (net === 0) return
    const dv = net * PUSH_EXTERNAL_ACCELERATION * TICK_SECONDS
    for (const p of this.participants) {
      p.externalVelocity.x += contact.nx * dv
      p.externalVelocity.y += contact.ny * dv
      clampExternal(p.externalVelocity)
    }
  }

  // Counts down the current Push phase: startup -> active -> recovery -> idle.
  private advanceAction(p: MutableParticipant): void {
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

  // Each participant faces the other; keeps the previous facing if positions coincide.
  private updateFacing(): void {
    const [a, b] = this.participants
    a.facing = facingToward(a.position, b.position, a.facing)
    b.facing = facingToward(b.position, a.position, b.facing)
  }
}
