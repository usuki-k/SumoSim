// Product Tsuppari pose art (ACTION-07D; User-accepted SEPARATE strategy). Pure presentation metadata; must not
// import Phaser. All four textures come from tools/wrestler_art/export_tsuppari.py: two authored red poses (left /
// right hand) normalized like the idle master; blue = the accepted local-Y reflection + mawashi recolor, where
// the reflection swaps the wrestler's hand:
//   red left = red left pose, red right = red right pose
//   blue left = reflected red right, blue right = reflected red left
// The held pose covers the whole Tsuppari action (startup / active / recovery); image timing decides nothing.
import type { TsuppariHand } from '../sumo/BoutTypes.ts'
import type { ProductWrestlerArt, ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

// Every texture keeps the body core at 2R, like the idle sprites.
export const PRODUCT_TSUPPARI_BODY_CORE_DIAMETER_PX = 123.076923

function tsuppariArt(
  id: ProductWrestlerArtId,
  hand: TsuppariHand,
  width: number,
  height: number,
  pivot: { x: number; y: number },
): ProductWrestlerArt {
  return {
    id,
    textureKey: `product-tsuppari-${id}-${hand}`,
    assetPath: `assets/action/wrestler/tsuppari/${id}_${hand}.png`,
    width,
    height,
    pivot,
    bodyCoreDiameterPx: PRODUCT_TSUPPARI_BODY_CORE_DIAMETER_PX,
  }
}

// Size / pivot per exported file (verified against a fresh export by the wrestler-art Python tests).
export const PRODUCT_TSUPPARI_ART: Readonly<Record<ProductWrestlerArtId, Readonly<Record<TsuppariHand, ProductWrestlerArt>>>> = {
  red: {
    left: tsuppariArt('red', 'left', 198, 177, { x: 83, y: 94 }),
    right: tsuppariArt('red', 'right', 193, 163, { x: 79, y: 87 }),
  },
  blue: {
    left: tsuppariArt('blue', 'left', 193, 163, { x: 79, y: 76 }), // red right reflected: y -> 163 - 87
    right: tsuppariArt('blue', 'right', 198, 177, { x: 83, y: 83 }), // red left reflected: y -> 177 - 94
  },
}

export function allProductTsuppariArts(): ProductWrestlerArt[] {
  return Object.values(PRODUCT_TSUPPARI_ART).flatMap((byHand) => [byHand.left, byHand.right])
}

// The held Tsuppari pose while the action lasts; otherwise the wrestler's accepted idle sprite.
export function selectWrestlerArt(idle: ProductWrestlerArt, state: WrestlerVisualState): ProductWrestlerArt {
  if (state.pose !== 'tsuppari' || state.tsuppariHand === null) return idle
  return PRODUCT_TSUPPARI_ART[idle.id][state.tsuppariHand]
}
