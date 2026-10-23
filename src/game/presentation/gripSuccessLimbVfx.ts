// Grip success arm / hand VFX Visual Gate (ACTION-11G, placement retuned in ACTION-11I). Provisional,
// presentation-only; not an accepted Product art contract. Pure TypeScript; must not import Phaser. While the Grip
// success pose is shown each wrestler gets two procedural arms that wrap around the opponent: a HIGH arm toward the
// opponent's upper torso / shoulder and a LOW arm around its flank to the waist / mawashi. Each arm is two straight
// segments meeting at an elbow placed on the opponent's outline: the upper arm (shoulder -> elbow) is drawn behind
// both bodies, so its root is hidden under the wrestler's own body; the forearm (elbow -> hand) is drawn above both
// bodies, so the hand lands on the opponent. Geometry is wrestler-local in units of the body radius R (+forward =
// FRONT, +lateral = wrestler RIGHT), anchored to the displayed body center (the canonical center + the Grip success
// display offset) and turned by the canonical facing only. Both wrestlers use the same local geometry, so a
// face-to-face pair is point-symmetric like the display offset. No timer, no animation.
// ACTION-11J: the geometry assumes an aligned face-to-face pair, so the limbs are shown only while BOTH wrestlers
// are in the success pose and neither is TURNING (Grappled Orientation); otherwise both wrestlers hide them.
import { isGripSuccessPose } from './gripSuccessGateArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export type GripSuccessLimbLayer = 'far' | 'near'
export type GripSuccessArm = 'high' | 'low'
export type GripSuccessArmSegment = 'upper' | 'forearm'

// One straight arm segment: the upper arm (shoulder -> elbow, no hand) or the forearm (elbow -> hand).
export interface GripSuccessLimb {
  readonly arm: GripSuccessArm
  readonly segment: GripSuccessArmSegment
  readonly layer: GripSuccessLimbLayer
  readonly startForwardR: number
  readonly startLateralR: number
  readonly endForwardR: number
  readonly endLateralR: number
  readonly widthR: number // arm thickness
  readonly handRadiusR: number // 0 = no hand (the end is a plain round cap of the arm width)
}

// LOW arm on the wrestler RIGHT (long, reaches the opponent's back near the mawashi); HIGH arm on the LEFT (short
// visible forearm on the opponent's shoulder). Each forearm starts exactly at its upper arm's elbow.
export const GRIP_SUCCESS_LIMBS: readonly GripSuccessLimb[] = [
  { arm: 'low', segment: 'upper', layer: 'far', startForwardR: 0.35, startLateralR: 0.8, endForwardR: 1.55, endLateralR: 1.5, widthR: 0.26, handRadiusR: 0 },
  { arm: 'low', segment: 'forearm', layer: 'near', startForwardR: 1.55, startLateralR: 1.5, endForwardR: 2.2, endLateralR: 1.15, widthR: 0.26, handRadiusR: 0.19 },
  { arm: 'high', segment: 'upper', layer: 'far', startForwardR: 0.35, startLateralR: -0.8, endForwardR: 1.25, endLateralR: -0.75, widthR: 0.24, handRadiusR: 0 },
  { arm: 'high', segment: 'forearm', layer: 'near', startForwardR: 1.25, startLateralR: -0.75, endForwardR: 1.6, endLateralR: -0.45, widthR: 0.24, handRadiusR: 0.17 },
]

export interface GripSuccessLimbPlacement {
  readonly layer: GripSuccessLimbLayer
  readonly start: { x: number; y: number } // canvas px
  readonly end: { x: number; y: number }
  readonly angle: number // start -> end, canvas radians
  readonly lengthPx: number
  readonly widthPx: number
  readonly handRadiusPx: number
}

export function gripSuccessLimbsVisible(state: WrestlerVisualState): boolean {
  return isGripSuccessPose(state)
}

// Pair-level visibility (same answer for both wrestlers): success pose on both sides and neither TURNING.
export function gripSuccessPairLimbsVisible(self: WrestlerVisualState, opponent: WrestlerVisualState): boolean {
  return gripSuccessLimbsVisible(self) && gripSuccessLimbsVisible(opponent) && !self.turning && !opponent.turning
}

function localToCanvas(
  center: { x: number; y: number },
  forwardR: number,
  lateralR: number,
  facing: number,
  bodyRadiusPx: number,
): { x: number; y: number } {
  const c = Math.cos(facing)
  const s = Math.sin(facing)
  const f = forwardR * bodyRadiusPx
  const l = lateralR * bodyRadiusPx
  return { x: center.x + f * c - l * s, y: center.y + f * s + l * c }
}

// Canvas placement of one limb from the displayed body center (px) and the canonical facing.
export function gripSuccessLimbPlacement(
  limb: GripSuccessLimb,
  displayCenterPx: { x: number; y: number },
  facing: number,
  bodyRadiusPx: number,
): GripSuccessLimbPlacement {
  const start = localToCanvas(displayCenterPx, limb.startForwardR, limb.startLateralR, facing, bodyRadiusPx)
  const end = localToCanvas(displayCenterPx, limb.endForwardR, limb.endLateralR, facing, bodyRadiusPx)
  return {
    layer: limb.layer,
    start,
    end,
    angle: Math.atan2(end.y - start.y, end.x - start.x),
    lengthPx: Math.hypot(end.x - start.x, end.y - start.y),
    widthPx: limb.widthR * bodyRadiusPx,
    handRadiusPx: limb.handRadiusR * bodyRadiusPx,
  }
}
