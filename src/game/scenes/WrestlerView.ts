// Rigid Product wrestler (ACTION-ART-03A). Presentation only: one authored full-body sprite per wrestler,
// placed at the canonical Snapshot position and rotated whole to the canonical facing (never mirrored, no
// per-limb transforms or body deformation). A procedural world shadow sits below both bodies.
// During a Tsuppari action the sprite swaps to the held Product Tsuppari pose texture of that hand (ACTION-07D);
// each texture keeps its own pivot / body-core scale, so the canonical center and facing are unchanged by the
// swap.
import Phaser from 'phaser'
import {
  PRODUCT_WRESTLER_ART,
  productWrestlerOrigin,
  productWrestlerScale,
  type ProductWrestlerArt,
} from '../presentation/productWrestlerArt.ts'
import { allProductTsuppariArts, selectWrestlerArt } from '../presentation/productTsuppariArt.ts'
import type { WrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import type { ParticipantState } from '../sumo/BoutTypes.ts'

export const WRESTLER_SHADOW_DEPTH = 1
export const WRESTLER_BODY_DEPTH = 2

// Near-circular soft shadow in units of the body radius R, offset in world space (down-right).
const SHADOW_SIZE = { x: 2.25, y: 2.0 }
const SHADOW_ALPHA = 0.28
const SHADOW_OFFSET = { x: 0.07, y: 0.12 }

export function preloadProductWrestlers(scene: Phaser.Scene): void {
  for (const art of [...Object.values(PRODUCT_WRESTLER_ART), ...allProductTsuppariArts()]) {
    scene.load.image(art.textureKey, `${import.meta.env.BASE_URL}${art.assetPath}`)
  }
}

// Draws the shadow once into the Texture Manager (Graphics.generateTexture).
function ensureShadowTexture(scene: Phaser.Scene, R: number): string {
  const key = `wrestler-shadow-${Math.round(R)}`
  if (scene.textures.exists(key)) return key
  const size = Math.ceil(2.6 * R)
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  g.fillStyle(0x000000, SHADOW_ALPHA)
  g.fillEllipse(size / 2, size / 2, SHADOW_SIZE.x * R, SHADOW_SIZE.y * R)
  g.generateTexture(key, size, size)
  g.destroy()
  return key
}

export class WrestlerView {
  private readonly shadow: Phaser.GameObjects.Image
  private readonly body: Phaser.GameObjects.Image
  private readonly R: number
  private readonly idleArt: ProductWrestlerArt
  private shownTextureKey = ''
  // Presentation-only memory for the idle / move hysteresis (not gameplay state).
  moving = false

  constructor(scene: Phaser.Scene, bodyRadiusPx: number, art: ProductWrestlerArt) {
    this.R = bodyRadiusPx
    this.idleArt = art
    this.shadow = scene.add.image(0, 0, ensureShadowTexture(scene, bodyRadiusPx))
    this.body = scene.add.image(0, 0, art.textureKey)
    this.show(art)
    // Shadows below both wrestlers, bodies above the shadows (debug overlays / texts sit higher).
    this.shadow.setDepth(WRESTLER_SHADOW_DEPTH)
    this.body.setDepth(WRESTLER_BODY_DEPTH)
  }

  // `positionPx` is the canonical center already converted to canvas pixels; facing is applied exactly.
  apply(state: WrestlerVisualState, participant: ParticipantState, positionPx: { x: number; y: number }): void {
    this.moving = state.pose === 'move'
    this.show(selectWrestlerArt(this.idleArt, state))
    this.body.setPosition(positionPx.x, positionPx.y).setRotation(participant.facing)
    this.shadow.setPosition(positionPx.x + SHADOW_OFFSET.x * this.R, positionPx.y + SHADOW_OFFSET.y * this.R)
    this.shadow.setRotation(participant.facing)
  }

  // Texture + its own pivot origin and body-core scale (only when the texture changes).
  private show(art: ProductWrestlerArt): void {
    if (art.textureKey === this.shownTextureKey) return
    this.shownTextureKey = art.textureKey
    const origin = productWrestlerOrigin(art)
    this.body
      .setTexture(art.textureKey)
      .setOrigin(origin.x, origin.y)
      .setScale(productWrestlerScale(art, this.R))
  }
}
