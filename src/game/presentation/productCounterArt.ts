// Product Counter / hiki-sabaki art (ACTION-08C; accepted by User Play Test after the ACTION-08A / 08A1 / 08B Visual
// Gate). Pure presentation; must not import Phaser. Both textures come from tools/wrestler_art/export_counter.py:
// red = the authored red Counter pose normalized like the idle master; blue = that red reflected across the local
// X axis + the accepted offline mawashi recolor (Counter has no hand, so one pose per colour).
// Shown exactly while the Simulation-derived visual pose is 'counter'; no presentation timer of its own.
// Body sabaki: during the Counter window the body also turns 0 -> 35 deg -> 0 (sin of the window progress) on top
// of the canonical facing, mirrored by colour: the red pose sweeps its arm toward local +Y, the reflected blue
// toward -Y, so +turn (red) / -turn (blue) both swing the arm away from the forward line.
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import { selectWrestlerArt } from './productTsuppariArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

// Body core at 2R, like the idle sprites.
export const PRODUCT_COUNTER_BODY_CORE_DIAMETER_PX = 123.076923

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
export const PRODUCT_COUNTER_ART: Readonly<Record<ProductWrestlerArtId, ProductWrestlerArt>> = {
  red: {
    id: 'red',
    textureKey: 'product-counter-red',
    assetPath: 'assets/action/wrestler/counter/red.png',
    width: 210,
    height: 207,
    pivot: { x: 74, y: 115 },
    bodyCoreDiameterPx: PRODUCT_COUNTER_BODY_CORE_DIAMETER_PX,
  },
  blue: {
    id: 'blue',
    textureKey: 'product-counter-blue',
    assetPath: 'assets/action/wrestler/counter/blue.png',
    width: 210,
    height: 207,
    pivot: { x: 74, y: 92 }, // red pivot (74, 115) reflected: y -> 207 - 115
    bodyCoreDiameterPx: PRODUCT_COUNTER_BODY_CORE_DIAMETER_PX,
  },
}

export const COUNTER_VISUAL_MAX_ROTATION_RAD = (35 * Math.PI) / 180
const COUNTER_ROTATION_SIGN: Readonly<Record<ProductWrestlerArtId, number>> = { red: 1, blue: -1 }

// Extra presentation-only body rotation (radians) added to participant.facing; exactly 0 outside Counter.
export function counterVisualRotationOffset(id: ProductWrestlerArtId, state: WrestlerVisualState): number {
  if (state.pose !== 'counter') return 0
  return COUNTER_ROTATION_SIGN[id] * Math.sin(Math.PI * state.phaseProgress) * COUNTER_VISUAL_MAX_ROTATION_RAD
}

export function allProductCounterArts(): ProductWrestlerArt[] {
  return [PRODUCT_COUNTER_ART.red, PRODUCT_COUNTER_ART.blue]
}

// Counter pose while the pose is 'counter'; otherwise the Product selection (Tsuppari pose or idle sprite).
export function selectWrestlerPoseArt(idle: ProductWrestlerArt, state: WrestlerVisualState): ProductWrestlerArt {
  if (state.pose === 'counter') return PRODUCT_COUNTER_ART[idle.id]
  return selectWrestlerArt(idle, state)
}
