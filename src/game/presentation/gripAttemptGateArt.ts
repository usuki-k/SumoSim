// Temporary Grip attempt Visual Gate art (ACTION-11A; provisional until User Play Test accepts it, not Product art).
// Pure presentation; must not import Phaser. Both textures come from tools/wrestler_art/export_grip_attempt_gate.py:
// red = the authored red Grip attempt pose normalized like the idle master; blue = that red reflected across the local
// X axis + the accepted offline mawashi recolor (Grip attempt has no hand semantics, so one pose per colour).
// Shown exactly while the Simulation-derived visual pose is 'grip' in its 'reach' phase. Grip recovery (whiff) and
// a successful Grip (grapple) fall straight back to the existing selection; no presentation timer of its own.
import { selectWrestlerPoseArt } from './productCounterArt.ts'
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

// Body core at 2R, like the idle sprites.
export const GRIP_ATTEMPT_GATE_BODY_CORE_DIAMETER_PX = 123.076923

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
export const GRIP_ATTEMPT_GATE_ART: Readonly<Record<ProductWrestlerArtId, ProductWrestlerArt>> = {
  red: {
    id: 'red',
    textureKey: 'grip-attempt-gate-red',
    assetPath: 'assets/action/wrestler/grip-attempt-gate/red.png',
    width: 195,
    height: 190,
    pivot: { x: 81, y: 105 },
    bodyCoreDiameterPx: GRIP_ATTEMPT_GATE_BODY_CORE_DIAMETER_PX,
  },
  blue: {
    id: 'blue',
    textureKey: 'grip-attempt-gate-blue',
    assetPath: 'assets/action/wrestler/grip-attempt-gate/blue.png',
    width: 195,
    height: 190,
    pivot: { x: 81, y: 85 }, // red pivot (81, 105) reflected: y -> 190 - 105
    bodyCoreDiameterPx: GRIP_ATTEMPT_GATE_BODY_CORE_DIAMETER_PX,
  },
}

export function allGripAttemptGateArts(): ProductWrestlerArt[] {
  return [GRIP_ATTEMPT_GATE_ART.red, GRIP_ATTEMPT_GATE_ART.blue]
}

// Grip attempt pose during Grip reach; otherwise the existing selection (Counter / Tsuppari pose or idle sprite).
export function selectWrestlerDisplayArt(idle: ProductWrestlerArt, state: WrestlerVisualState): ProductWrestlerArt {
  if (state.pose === 'grip' && state.gripPhase === 'reach') return GRIP_ATTEMPT_GATE_ART[idle.id]
  return selectWrestlerPoseArt(idle, state)
}
