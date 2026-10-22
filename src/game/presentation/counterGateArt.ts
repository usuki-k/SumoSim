// Counter / hiki-sabaki art Visual Gate (ACTION-08A). Provisional, presentation-only candidate; not an accepted
// Product art contract. Must not import Phaser. Both textures come from tools/wrestler_art/export_counter_gate.py:
// red = the authored red Counter pose normalized like the idle master; blue = that red reflected across the local
// X axis + the accepted offline mawashi recolor (Counter has no hand, so one pose per colour).
// Shown exactly while the Simulation-derived visual pose is 'counter'; no presentation timer of its own.
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import { selectWrestlerArt } from './productTsuppariArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

// Body core at 2R, like the idle sprites.
export const COUNTER_GATE_BODY_CORE_DIAMETER_PX = 123.076923

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
export const COUNTER_GATE_ART: Readonly<Record<ProductWrestlerArtId, ProductWrestlerArt>> = {
  red: {
    id: 'red',
    textureKey: 'counter-gate-red',
    assetPath: 'assets/action/wrestler/counter-gate/red.png',
    width: 210,
    height: 207,
    pivot: { x: 74, y: 115 },
    bodyCoreDiameterPx: COUNTER_GATE_BODY_CORE_DIAMETER_PX,
  },
  blue: {
    id: 'blue',
    textureKey: 'counter-gate-blue',
    assetPath: 'assets/action/wrestler/counter-gate/blue.png',
    width: 210,
    height: 207,
    pivot: { x: 74, y: 92 }, // red pivot (74, 115) reflected: y -> 207 - 115
    bodyCoreDiameterPx: COUNTER_GATE_BODY_CORE_DIAMETER_PX,
  },
}

export function allCounterGateArts(): ProductWrestlerArt[] {
  return [COUNTER_GATE_ART.red, COUNTER_GATE_ART.blue]
}

// Counter candidate while the pose is 'counter'; otherwise the Product selection (Tsuppari pose or idle sprite).
export function selectWrestlerPoseArt(idle: ProductWrestlerArt, state: WrestlerVisualState): ProductWrestlerArt {
  if (state.pose === 'counter') return COUNTER_GATE_ART[idle.id]
  return selectWrestlerArt(idle, state)
}
