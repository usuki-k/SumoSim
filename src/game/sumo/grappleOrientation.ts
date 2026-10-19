// Grappled orientation readiness (ACTION-05B1). Pure TypeScript; must not import Phaser.
// Readiness is derived from canonical position + facing + engagement; nothing here is stored.
// Shared by BoutSimulation (gameplay) and the Scene (TURNING / READY presentation).
import type { BoutEngagement, Vec2 } from './BoutTypes.ts'

// Provisional Prototype tuning, subject to User Play Test.
export const GRAPPLE_TURN_RATE = Math.PI // rad/s while grappled (180 deg/s)
export const GRAPPLE_FACING_TOLERANCE = Math.PI / 12 // |facing error| within 15 deg counts as READY

// Technical (not balance): errors this close to +-PI turn in the fixed + direction.
const REAR_TIE_EPSILON = 1e-9
// Below this center distance the bearing is undefined; the error is treated as 0 (READY).
const MIN_BEARING_DISTANCE = 1e-9
const TWO_PI = 2 * Math.PI

interface Oriented {
  readonly position: Vec2
  readonly facing: number
}

// Wraps an angle into (-PI, PI]; exactly -PI maps to +PI.
export function normalizeAngle(angle: number): number {
  let r = angle % TWO_PI
  if (r <= -Math.PI) r += TWO_PI
  else if (r > Math.PI) r -= TWO_PI
  return r
}

// Signed shortest rotation (rad) from `facing` to the bearing toward `opponent`, in (-PI, PI].
// +y-down canvas coordinates: a positive error is a clockwise turn on screen.
export function grappleFacingError(self: Vec2, facing: number, opponent: Vec2): number {
  const dx = opponent.x - self.x
  const dy = opponent.y - self.y
  if (Math.hypot(dx, dy) <= MIN_BEARING_DISTANCE) return 0
  return normalizeAngle(Math.atan2(dy, dx) - facing)
}

export function isGrappleReady(self: Vec2, facing: number, opponent: Vec2): boolean {
  return Math.abs(grappleFacingError(self, facing, opponent)) <= GRAPPLE_FACING_TOLERANCE
}

// One grappled facing update: rotate toward the opponent by at most `maxTurn` along the shortest
// path (an exact rear tie turns +), snapping exactly onto the bearing once within one step.
export function turnFacingTowardGrapple(self: Vec2, facing: number, opponent: Vec2, maxTurn: number): number {
  const error = grappleFacingError(self, facing, opponent)
  if (Math.abs(error) <= maxTurn) {
    const dx = opponent.x - self.x
    const dy = opponent.y - self.y
    return Math.hypot(dx, dy) <= MIN_BEARING_DISTANCE ? facing : Math.atan2(dy, dx)
  }
  const direction = Math.abs(error) >= Math.PI - REAR_TIE_EPSILON ? 1 : Math.sign(error)
  return normalizeAngle(facing + direction * maxTurn)
}

// The single gate for participant-initiated grappled actions (Release now; Drive / Throw / Lift
// later): only while grappled, and only once this participant faces its opponent within tolerance.
export function canActInGrapple(self: Oriented, opponent: Oriented, engagement: BoutEngagement): boolean {
  return engagement.kind === 'grappled' && isGrappleReady(self.position, self.facing, opponent.position)
}
