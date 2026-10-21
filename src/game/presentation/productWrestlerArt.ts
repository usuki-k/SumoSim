// Rigid Product wrestler art contract (ACTION-ART-03A). Pure presentation metadata; must not import Phaser.
// Each wrestler is one authored full-body sprite exported by tools/wrestler_art/export_runtime_wrestlers.py
// (ART-WRESTLER-03A normalization: FRONT = local +X, explicit body core = 2R at 1x Product scale). The
// sprite is never mirrored: the canonical participant position and facing place and rotate it whole.
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
    width: 167,
    height: 181,
    pivot: { x: 84, y: 87 },
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
