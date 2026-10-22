// Kuzushi sweat Visual Gate (ACTION-09A). Provisional, presentation-only overlay; not an accepted Product art
// contract. Pure TypeScript; must not import Phaser. While the Simulation-derived visual pose is 'kuzushi' two
// procedural sweat drops sit beside the head, faded by the existing kuzushiStrength (1 fresh -> 0 recovering).
// No timer of its own: during a Counter transition the pusher's Kuzushi timer is paused, so the sweat stays full.
// Placement is wrestler-local in units of the body radius R (+forward = FRONT, +lateral = wrestler RIGHT) and
// follows the canonical facing only (never the Counter body turn). The blue sprite is the red one reflected
// across the local X axis, so its head sits on the other side: the lateral offsets are mirrored with it.
import type { ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export interface KuzushiSweatDrop {
  readonly forwardR: number
  readonly lateralR: number
  readonly widthR: number
  readonly heightR: number
}

export interface KuzushiSweatVisual {
  readonly visible: boolean
  readonly alpha: number
  readonly drops: readonly KuzushiSweatDrop[]
}

// Red idle head centroid is at about (+0.58 R, +0.42 R): the large drop sits front-right of it, the small one on
// its left edge.
const RED_SWEAT_DROPS: readonly KuzushiSweatDrop[] = [
  { forwardR: 0.9, lateralR: 0.62, widthR: 0.2, heightR: 0.34 },
  { forwardR: 0.78, lateralR: -0.13, widthR: 0.15, heightR: 0.26 },
]

export const KUZUSHI_SWEAT_DROPS: Readonly<Record<ProductWrestlerArtId, readonly KuzushiSweatDrop[]>> = {
  red: RED_SWEAT_DROPS,
  blue: RED_SWEAT_DROPS.map((d) => ({ ...d, lateralR: -d.lateralR })),
}

export function kuzushiSweatVisual(id: ProductWrestlerArtId, state: WrestlerVisualState): KuzushiSweatVisual {
  const alpha = state.pose === 'kuzushi' ? Math.min(1, Math.max(0, state.kuzushiStrength)) : 0
  return { visible: alpha > 0, alpha, drops: KUZUSHI_SWEAT_DROPS[id] }
}

// Canvas offset (px) of a drop from the canonical participant center for the canonical facing.
export function kuzushiSweatOffsetPx(drop: KuzushiSweatDrop, facing: number, bodyRadiusPx: number): { x: number; y: number } {
  const c = Math.cos(facing)
  const s = Math.sin(facing)
  const f = drop.forwardR * bodyRadiusPx
  const l = drop.lateralR * bodyRadiusPx
  return { x: f * c - l * s, y: f * s + l * c }
}
