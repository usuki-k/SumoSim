// Tsuppari Art Visual Gate (ACTION-07C). Temporary, presentation-only comparison of three ways to produce
// the left / right Tsuppari pose art; not an accepted Product art contract. Must not import Phaser.
// All textures come from tools/wrestler_art/export_tsuppari_gate.py (two authored red poses; blue = the
// accepted local-Y reflection + mawashi recolor, where the reflection swaps the wrestler's hand):
//   separate     : red L / R authored; blue L = reflected red R, blue R = reflected red L
//   mirror-left  : only red L; red R / blue R = reflected red L, blue L = red L recolored
//   mirror-right : only red R; red L / blue L = reflected red R, blue R = red R recolored
// The held pose covers the whole Tsuppari action (startup / active / recovery); image timing decides nothing.
import type { TsuppariHand } from '../sumo/BoutTypes.ts'
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export type TsuppariArtMode = 'separate' | 'mirror-left' | 'mirror-right'

// Key 4 cycles in this order.
export const TSUPPARI_ART_MODES: readonly TsuppariArtMode[] = ['separate', 'mirror-left', 'mirror-right']

export const TSUPPARI_ART_MODE_LABEL: Readonly<Record<TsuppariArtMode, string>> = {
  separate: 'SEPARATE',
  'mirror-left': 'MIRROR-L',
  'mirror-right': 'MIRROR-R',
}

export function nextTsuppariArtMode(mode: TsuppariArtMode): TsuppariArtMode {
  return TSUPPARI_ART_MODES[(TSUPPARI_ART_MODES.indexOf(mode) + 1) % TSUPPARI_ART_MODES.length]
}

// File prefix of each mode in public/assets/action/wrestler/tsuppari-gate/.
const MODE_FILE_PREFIX: Readonly<Record<TsuppariArtMode, string>> = {
  separate: 'separate',
  'mirror-left': 'mirror_l',
  'mirror-right': 'mirror_r',
}

// Every texture keeps the body core at 2R, like the idle sprites.
export const TSUPPARI_GATE_BODY_CORE_DIAMETER_PX = 123.076923

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
const GATE_TEXTURES: Readonly<Record<string, { width: number; height: number; pivot: { x: number; y: number } }>> = {
  separate_red_left: { width: 198, height: 177, pivot: { x: 83, y: 94 } },
  separate_red_right: { width: 209, height: 167, pivot: { x: 79, y: 87 } },
  separate_blue_left: { width: 209, height: 167, pivot: { x: 79, y: 80 } },
  separate_blue_right: { width: 198, height: 177, pivot: { x: 83, y: 83 } },
  mirror_l_red_left: { width: 198, height: 177, pivot: { x: 83, y: 94 } },
  mirror_l_red_right: { width: 198, height: 177, pivot: { x: 83, y: 83 } },
  mirror_l_blue_left: { width: 198, height: 177, pivot: { x: 83, y: 94 } },
  mirror_l_blue_right: { width: 198, height: 177, pivot: { x: 83, y: 83 } },
  mirror_r_red_left: { width: 209, height: 167, pivot: { x: 79, y: 80 } },
  mirror_r_red_right: { width: 209, height: 167, pivot: { x: 79, y: 87 } },
  mirror_r_blue_left: { width: 209, height: 167, pivot: { x: 79, y: 80 } },
  mirror_r_blue_right: { width: 209, height: 167, pivot: { x: 79, y: 87 } },
}

export function tsuppariGateArt(mode: TsuppariArtMode, id: ProductWrestlerArtId, hand: TsuppariHand): ProductWrestlerArt {
  const stem = `${MODE_FILE_PREFIX[mode]}_${id}_${hand}`
  const texture = GATE_TEXTURES[stem]
  return {
    id,
    textureKey: `tsuppari-gate-${stem}`,
    assetPath: `assets/action/wrestler/tsuppari-gate/${stem}.png`,
    width: texture.width,
    height: texture.height,
    pivot: texture.pivot,
    bodyCoreDiameterPx: TSUPPARI_GATE_BODY_CORE_DIAMETER_PX,
  }
}

export function allTsuppariGateArts(): ProductWrestlerArt[] {
  const ids: readonly ProductWrestlerArtId[] = ['red', 'blue']
  const hands: readonly TsuppariHand[] = ['left', 'right']
  return TSUPPARI_ART_MODES.flatMap((mode) => ids.flatMap((id) => hands.map((hand) => tsuppariGateArt(mode, id, hand))))
}

// The held Tsuppari pose while the action lasts; otherwise the wrestler's accepted idle sprite.
export function selectWrestlerArt(idle: ProductWrestlerArt, state: WrestlerVisualState, mode: TsuppariArtMode): ProductWrestlerArt {
  if (state.pose !== 'tsuppari' || state.tsuppariHand === null) return idle
  return tsuppariGateArt(mode, idle.id, state.tsuppariHand)
}
