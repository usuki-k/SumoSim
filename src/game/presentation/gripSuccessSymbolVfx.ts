// Grip success symbolic forearm + hand VFX Visual Gate (ACTION-11K; replaces the connected-arm limbs of ACTION-11G /
// 11J). Provisional, presentation-only; not an accepted Product art contract. Pure TypeScript; must not import Phaser.
// Like the Kuzushi sweat, this is an anime-style symbol, not anatomy: a short, slightly bent forearm ending in a mitten
// hand, laid over the waist / mawashi of the wrestler it grips and not connected to the gripping wrestler's body.
// Each wrestler's view draws the one marker that lands on ITS OWN waist (the opponent's grip), so a pair shows exactly
// two markers. Placement is target-local in units of the body radius R (+forward = FRONT, -forward = BACK / mawashi
// knot, +lateral = wrestler RIGHT) from the target's displayed body center (canonical + Grip success display offset)
// and its canonical facing. Both wrestlers use the same local anchor, so a face-to-face pair shows the two markers
// point-symmetrically on complementary sides. The geometry assumes an aligned pair: shown only while both wrestlers
// are in the success pose and neither is TURNING (ACTION-11J rule). No timer, no fade, no animation.
import { isGripSuccessPose } from './gripSuccessGateArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export interface GripSuccessSymbol {
  readonly elbowForwardR: number // forearm start (rounded elbow end)
  readonly elbowLateralR: number
  readonly handForwardR: number // hand center, on the mawashi
  readonly handLateralR: number
  readonly widthR: number // forearm thickness
  readonly handRadiusR: number
  readonly bend: number // forearm bulge toward the thumb side, as a fraction of the forearm length
}

// On the target's right flank, the hand landing on the back half of the waist (mawashi).
export const GRIP_SUCCESS_SYMBOL: GripSuccessSymbol = {
  elbowForwardR: -0.1,
  elbowLateralR: 0.95,
  handForwardR: -0.55,
  handLateralR: 0.6,
  widthR: 0.2,
  handRadiusR: 0.18,
  bend: 0.12,
}

export function gripSuccessSymbolLengthR(symbol: GripSuccessSymbol): number {
  return Math.hypot(symbol.handForwardR - symbol.elbowForwardR, symbol.handLateralR - symbol.elbowLateralR)
}

// Pair-level visibility (same answer for both wrestlers): success pose on both sides and neither TURNING.
export function gripSuccessPairSymbolVisible(self: WrestlerVisualState, opponent: WrestlerVisualState): boolean {
  return isGripSuccessPose(self) && isGripSuccessPose(opponent) && !self.turning && !opponent.turning
}

export interface GripSuccessSymbolPlacement {
  readonly elbow: { x: number; y: number } // canvas px (texture origin)
  readonly hand: { x: number; y: number }
  readonly angle: number // elbow -> hand, canvas radians
  readonly lengthPx: number
  readonly widthPx: number
  readonly handRadiusPx: number
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

// Canvas placement of the marker on a target wrestler from its displayed body center (px) and canonical facing.
export function gripSuccessSymbolPlacement(
  targetDisplayCenterPx: { x: number; y: number },
  targetFacing: number,
  bodyRadiusPx: number,
  symbol: GripSuccessSymbol = GRIP_SUCCESS_SYMBOL,
): GripSuccessSymbolPlacement {
  const elbow = localToCanvas(targetDisplayCenterPx, symbol.elbowForwardR, symbol.elbowLateralR, targetFacing, bodyRadiusPx)
  const hand = localToCanvas(targetDisplayCenterPx, symbol.handForwardR, symbol.handLateralR, targetFacing, bodyRadiusPx)
  return {
    elbow,
    hand,
    angle: Math.atan2(hand.y - elbow.y, hand.x - elbow.x),
    lengthPx: Math.hypot(hand.x - elbow.x, hand.y - elbow.y),
    widthPx: symbol.widthR * bodyRadiusPx,
    handRadiusPx: symbol.handRadiusR * bodyRadiusPx,
  }
}
