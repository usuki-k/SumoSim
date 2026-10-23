// Grip success arm / hand VFX Visual Gate (ACTION-11G). Provisional, presentation-only; not an accepted Product art
// contract. Pure TypeScript; must not import Phaser. While the Grip success pose is shown each wrestler gets two
// procedural forearms with a rounded hand: a FAR arm drawn behind both bodies (wrapping behind the opponent) and a
// NEAR arm drawn above both bodies (crossing onto the opponent's side). Geometry is wrestler-local in units of the
// body radius R (+forward = FRONT, +lateral = wrestler RIGHT), anchored to the displayed body center (the canonical
// center + the Grip success display offset) and turned by the canonical facing only. Both wrestlers use the same
// local geometry, so a face-to-face pair is point-symmetric like the display offset. No timer, no animation.
import { isGripSuccessPose } from './gripSuccessGateArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export type GripSuccessLimbLayer = 'far' | 'near'

export interface GripSuccessLimb {
  readonly layer: GripSuccessLimbLayer
  readonly startForwardR: number // shoulder end
  readonly startLateralR: number
  readonly endForwardR: number // hand center
  readonly endLateralR: number
  readonly widthR: number // forearm thickness
  readonly handRadiusR: number
}

export const GRIP_SUCCESS_LIMBS: readonly GripSuccessLimb[] = [
  { layer: 'far', startForwardR: 0.18, startLateralR: 0.42, endForwardR: 0.82, endLateralR: 0.25, widthR: 0.2, handRadiusR: 0.15 },
  { layer: 'near', startForwardR: 0.22, startLateralR: -0.65, endForwardR: 1.12, endLateralR: -0.58, widthR: 0.22, handRadiusR: 0.16 },
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
