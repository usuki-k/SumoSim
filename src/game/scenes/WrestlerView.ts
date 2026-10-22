// Rigid Product wrestler (ACTION-ART-03A). Presentation only: one authored full-body sprite per wrestler,
// placed at the canonical Snapshot position and rotated whole to the canonical facing (never mirrored, no
// per-limb transforms or body deformation). A procedural world shadow sits below both bodies.
// During a Tsuppari action the sprite swaps to the held Product Tsuppari pose texture of that hand (ACTION-07D);
// each texture keeps its own pivot / body-core scale, so the canonical center and facing are unchanged by the
// swap. While the pose is Counter the Product Counter pose is shown the same way (ACTION-08C), with its
// presentation-only body turn on top of the canonical facing (body sprite only, never the shadow or the
// Simulation facing).
// ACTION-09A Visual Gate: while the pose is Kuzushi two procedural sweat drops (an overlay above the body) sit
// beside the head on the canonical facing, faded by kuzushiStrength; the body itself is untouched.
// ACTION-11A Visual Gate: during Grip reach the temporary Grip attempt pose is shown the same rigid way (no extra
// turn); Grip recovery and the grapple keep the existing selection.
import Phaser from 'phaser'
import {
  PRODUCT_WRESTLER_ART,
  productWrestlerOrigin,
  productWrestlerScale,
  type ProductWrestlerArt,
} from '../presentation/productWrestlerArt.ts'
import { allProductCounterArts, counterVisualRotationOffset } from '../presentation/productCounterArt.ts'
import { allGripAttemptGateArts, selectWrestlerDisplayArt } from '../presentation/gripAttemptGateArt.ts'
import { allProductTsuppariArts } from '../presentation/productTsuppariArt.ts'
import { KUZUSHI_SWEAT_DROPS, kuzushiSweatOffsetPx, kuzushiSweatVisual } from '../presentation/kuzushiVisualEffect.ts'
import type { WrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import type { ParticipantState } from '../sumo/BoutTypes.ts'

export const WRESTLER_SHADOW_DEPTH = 1
export const WRESTLER_BODY_DEPTH = 2
export const WRESTLER_EFFECT_DEPTH = 2.5 // above both bodies, below the debug overlays (3) and the HUD / texts (4)

// Near-circular soft shadow in units of the body radius R, offset in world space (down-right).
const SHADOW_SIZE = { x: 2.25, y: 2.0 }
const SHADOW_ALPHA = 0.28
const SHADOW_OFFSET = { x: 0.07, y: 0.12 }
// Kuzushi sweat drop colours (pale cyan body, darker blue rim, white highlight) and texture supersampling.
const SWEAT_FILL = 0xaee8ff
const SWEAT_RIM = 0x2a78c0
const SWEAT_TEXTURE_SCALE = 4

export function preloadProductWrestlers(scene: Phaser.Scene): void {
  for (const art of [
    ...Object.values(PRODUCT_WRESTLER_ART),
    ...allProductTsuppariArts(),
    ...allProductCounterArts(),
    ...allGripAttemptGateArts(),
  ]) {
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

// One upright teardrop (tip up), drawn once at SWEAT_TEXTURE_SCALE x the large drop and shared by both drops.
function ensureSweatTexture(scene: Phaser.Scene, R: number): string {
  const key = `kuzushi-sweat-${Math.round(R)}`
  if (scene.textures.exists(key)) return key
  const w = Math.ceil(0.2 * R * SWEAT_TEXTURE_SCALE)
  const h = Math.ceil(0.34 * R * SWEAT_TEXTURE_SCALE)
  const rim = Math.max(2, Math.round(w * 0.1))
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const drop = (inset: number, color: number) => {
    const r = w / 2 - inset
    const cy = h - w / 2
    g.fillStyle(color, 1)
    g.fillCircle(w / 2, cy, r)
    g.fillTriangle(w / 2 - r * 0.94, cy - r * 0.34, w / 2 + r * 0.94, cy - r * 0.34, w / 2, inset * 1.6)
  }
  drop(0, SWEAT_RIM)
  drop(rim, SWEAT_FILL)
  g.fillStyle(0xffffff, 0.9)
  g.fillEllipse(w * 0.36, h - w * 0.62, w * 0.18, w * 0.3)
  g.generateTexture(key, w, h)
  g.destroy()
  return key
}

export class WrestlerView {
  private readonly shadow: Phaser.GameObjects.Image
  private readonly body: Phaser.GameObjects.Image
  private readonly sweat: Phaser.GameObjects.Image[]
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
    const sweatKey = ensureSweatTexture(scene, bodyRadiusPx)
    this.sweat = KUZUSHI_SWEAT_DROPS[art.id].map((d) =>
      scene.add
        .image(0, 0, sweatKey)
        .setDisplaySize(d.widthR * bodyRadiusPx, d.heightR * bodyRadiusPx)
        .setDepth(WRESTLER_EFFECT_DEPTH)
        .setVisible(false),
    )
  }

  // `positionPx` is the canonical center already converted to canvas pixels; facing is applied exactly.
  apply(state: WrestlerVisualState, participant: ParticipantState, positionPx: { x: number; y: number }): void {
    this.moving = state.pose === 'move'
    this.show(selectWrestlerDisplayArt(this.idleArt, state))
    this.body
      .setPosition(positionPx.x, positionPx.y)
      .setRotation(participant.facing + counterVisualRotationOffset(this.idleArt.id, state))
    this.shadow.setPosition(positionPx.x + SHADOW_OFFSET.x * this.R, positionPx.y + SHADOW_OFFSET.y * this.R)
    this.shadow.setRotation(participant.facing)
    // Overlay only: placed from the canonical center / facing (not the Counter body turn); drops stay upright.
    const sweat = kuzushiSweatVisual(this.idleArt.id, state)
    sweat.drops.forEach((drop, i) => {
      const offset = kuzushiSweatOffsetPx(drop, participant.facing, this.R)
      this.sweat[i].setVisible(sweat.visible).setAlpha(sweat.alpha).setPosition(positionPx.x + offset.x, positionPx.y + offset.y)
    })
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
