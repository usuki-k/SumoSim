// Rigid Product wrestler art contract (ACTION-ART-03A / ART-WRESTLER-04B). Pure presentation metadata; must
// not import Phaser. Both runtime sprites come from one authored red master via
// tools/wrestler_art/export_runtime_wrestlers.py: red = the normalized master (FRONT = local +X, explicit body
// core = 2R at 1x Product scale); blue = that red reflected across the local X axis ((x, y) -> (x, H - y),
// FRONT kept) with an offline mawashi recolor. At runtime neither is flipped: the canonical participant
// position and facing place and rotate each sprite whole.
import type { Vec2 } from '../sumo/BoutTypes.ts'

export type ProductWrestlerArtId = 'blue' | 'red'

export interface ProductWrestlerArt {
  readonly id: ProductWrestlerArtId
  readonly textureKey: string
  // Relative to the public asset base (the Phaser view prefixes BASE_URL).
  readonly assetPath: string
  readonly width: number
  readonly height: number
  // Participant center in texture px (pixel edges on integers) = rotation pivot.
  readonly pivot: Vec2
  // Explicit body-core cross-section (2R at export) in texture px; the runtime scale reference.
  readonly bodyCoreDiameterPx: number
}

// Values reported by the exporter for the committed files (verified by the wrestler-art tests).
export const PRODUCT_WRESTLER_ART: Readonly<Record<ProductWrestlerArtId, ProductWrestlerArt>> = {
  blue: {
    id: 'blue',
    textureKey: 'product-wrestler-blue',
    assetPath: 'assets/action/wrestler/blue.png',
    width: 158,
    height: 178,
    pivot: { x: 82, y: 83 }, // red pivot (82, 95) reflected: y -> 178 - 95
    bodyCoreDiameterPx: 123.076923,
  },
  red: {
    id: 'red',
    textureKey: 'product-wrestler-red',
    assetPath: 'assets/action/wrestler/red.png',
    width: 158,
    height: 178,
    pivot: { x: 82, y: 95 },
    bodyCoreDiameterPx: 123.076923,
  },
}

// Phaser origin that puts the explicit pivot on the image position.
export function productWrestlerOrigin(art: ProductWrestlerArt): Vec2 {
  return { x: art.pivot.x / art.width, y: art.pivot.y / art.height }
}

// Uniform display scale that keeps the art's body core on the canonical gameplay body diameter.
export function productWrestlerScale(art: ProductWrestlerArt, bodyRadiusPx: number): number {
  return (2 * bodyRadiusPx) / art.bodyCoreDiameterPx
}
