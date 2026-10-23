// Temporary Grip success Visual Gate art (ACTION-11D; provisional until the User Visual Gate accepts it, not Product
// art). Pure presentation; must not import Phaser. Both textures come from tools/wrestler_art/export_grip_success_gate.py:
// red = the authored red Grip success pose normalized like the idle master; blue = that red reflected across the
// local X axis + the accepted offline mawashi recolor, so the pair faces each other as mirrored grappling wrestlers.
// Shown exactly while the Simulation-derived visual pose is 'grapple' or 'drive' (the same pose for neutral and
// Morozashi, holder or not). A release drops it on that tick; everything else is the Grip attempt selection.
// ACTION-11E Visual Gate: while the success pose is shown, each sprite (and its shadow) is drawn a little to its own
// LEFT of the canonical center. Both wrestlers face each other, so the pair shifts point-symmetrically and the two
// heads slip past each other onto the opponent's shoulder instead of meeting nose to nose. Display only: the
// Simulation positions, bond distance and facing are unchanged.
import { selectWrestlerDisplayArt } from './gripAttemptGateArt.ts'
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

// Wrestler-local lateral display offset in units of R (+ = wrestler RIGHT, like the Kuzushi sweat placement).
export const GRIP_SUCCESS_LATERAL_OFFSET_R = -0.3

// Body core at 2R, like the idle sprites.
export const GRIP_SUCCESS_GATE_BODY_CORE_DIAMETER_PX = 123.076923

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
export const GRIP_SUCCESS_GATE_ART: Readonly<Record<ProductWrestlerArtId, ProductWrestlerArt>> = {
  red: {
    id: 'red',
    textureKey: 'grip-success-gate-red',
    assetPath: 'assets/action/wrestler/grip-success-gate/red.png',
    width: 160,
    height: 183,
    pivot: { x: 83, y: 98 },
    bodyCoreDiameterPx: GRIP_SUCCESS_GATE_BODY_CORE_DIAMETER_PX,
  },
  blue: {
    id: 'blue',
    textureKey: 'grip-success-gate-blue',
    assetPath: 'assets/action/wrestler/grip-success-gate/blue.png',
    width: 160,
    height: 183,
    pivot: { x: 83, y: 85 }, // red pivot (83, 98) reflected: y -> 183 - 98
    bodyCoreDiameterPx: GRIP_SUCCESS_GATE_BODY_CORE_DIAMETER_PX,
  },
}

export function allGripSuccessGateArts(): ProductWrestlerArt[] {
  return [GRIP_SUCCESS_GATE_ART.red, GRIP_SUCCESS_GATE_ART.blue]
}

function isGripSuccessPose(state: WrestlerVisualState): boolean {
  return state.pose === 'grapple' || state.pose === 'drive'
}

// Grip success pose while grappled (with or without Drive); otherwise the Grip attempt / Counter / Tsuppari / idle selection.
export function selectWrestlerArt(idle: ProductWrestlerArt, state: WrestlerVisualState): ProductWrestlerArt {
  if (isGripSuccessPose(state)) return GRIP_SUCCESS_GATE_ART[idle.id]
  return selectWrestlerDisplayArt(idle, state)
}

// Canvas offset (px) of the displayed sprite from the canonical center: the lateral offset for the canonical facing
// while the success pose is shown, otherwise zero.
export function gripSuccessDisplayOffsetPx(
  state: WrestlerVisualState,
  facing: number,
  bodyRadiusPx: number,
): { x: number; y: number } {
  if (!isGripSuccessPose(state)) return { x: 0, y: 0 }
  const l = GRIP_SUCCESS_LATERAL_OFFSET_R * bodyRadiusPx
  return { x: -l * Math.sin(facing), y: l * Math.cos(facing) }
}
