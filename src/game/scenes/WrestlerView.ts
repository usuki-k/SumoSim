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
// turn); Grip recovery keeps the existing selection.
// ACTION-11D Visual Gate: while grappled (pose grapple or drive) the temporary Grip success pose is shown the same
// rigid way at the canonical facing (no extra turn); a release returns to the idle sprite.
// ACTION-11E / 11F Visual Gate: while that success pose is shown, the body and its shadow are drawn at a small
// presentation-only forward + lateral offset from the canonical center (gripSuccessDisplayOffsetPx); zero otherwise.
// ACTION-11K Visual Gate (replaces the ACTION-11G / 11J connected arms): with that success pose, one symbolic
// forearm + hand marker (gripSuccessSymbolVfx) is laid over this wrestler's own waist / mawashi - the opponent's grip -
// from the displayed body center and the canonical facing, above both bodies. Shown only while both wrestlers are
// READY (hidden for both while either is TURNING) and hidden on every other pose (no timer, no fade).
import Phaser from 'phaser'
import {
  PRODUCT_WRESTLER_ART,
  productWrestlerOrigin,
  productWrestlerScale,
  type ProductWrestlerArt,
} from '../presentation/productWrestlerArt.ts'
import { allProductCounterArts, counterVisualRotationOffset } from '../presentation/productCounterArt.ts'
import { allGripAttemptGateArts } from '../presentation/gripAttemptGateArt.ts'
import {
  allGripSuccessGateArts,
  gripSuccessDisplayOffsetPx,
  selectWrestlerArt,
} from '../presentation/gripSuccessGateArt.ts'
import {
  GRIP_SUCCESS_SYMBOL,
  gripSuccessPairSymbolVisible,
  gripSuccessSymbolLengthR,
  gripSuccessSymbolPlacement,
} from '../presentation/gripSuccessSymbolVfx.ts'
import { allProductTsuppariArts } from '../presentation/productTsuppariArt.ts'
import { KUZUSHI_SWEAT_DROPS, kuzushiSweatOffsetPx, kuzushiSweatVisual } from '../presentation/kuzushiVisualEffect.ts'
import type { WrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import type { ParticipantState } from '../sumo/BoutTypes.ts'

export const WRESTLER_SHADOW_DEPTH = 1
export const WRESTLER_BODY_DEPTH = 2
export const WRESTLER_EFFECT_DEPTH = 2.5 // above both bodies, below the debug overlays (3) and the HUD / texts (4)
export const GRIP_SYMBOL_DEPTH = 2.3 // Grip success marker: above both bodies, below the Kuzushi sweat (2.5)

// Near-circular soft shadow in units of the body radius R, offset in world space (down-right).
const SHADOW_SIZE = { x: 2.25, y: 2.0 }
const SHADOW_ALPHA = 0.28
const SHADOW_OFFSET = { x: 0.07, y: 0.12 }
// Kuzushi sweat drop colours (pale cyan body, darker blue rim, white highlight) and texture supersampling.
const SWEAT_FILL = 0xaee8ff
const SWEAT_RIM = 0x2a78c0
const SWEAT_TEXTURE_SCALE = 4
// Grip success symbol: the mid / shade skin tones of the tone-matched success body (ACTION-11H, skin P50 / P20),
// a warm highlight, the wrestler outline colour; outline width in R and texture supersampling.
const GRIP_SYMBOL_SKIN = 0xf5b47d
const GRIP_SYMBOL_SHADE = 0xd38c56
const GRIP_SYMBOL_HIGHLIGHT = 0xfde0b8
const GRIP_SYMBOL_OUTLINE = 0x231612
const GRIP_SYMBOL_OUTLINE_R = 0.045
const GRIP_SYMBOL_TEXTURE_SCALE = 4

export function preloadProductWrestlers(scene: Phaser.Scene): void {
  for (const art of [
    ...Object.values(PRODUCT_WRESTLER_ART),
    ...allProductTsuppariArts(),
    ...allProductCounterArts(),
    ...allGripAttemptGateArts(),
    ...allGripSuccessGateArts(),
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

// The symbolic forearm (elbow at the origin, slightly bent toward the thumb side) + mitten hand with a thumb bump,
// drawn once at GRIP_SYMBOL_TEXTURE_SCALE x along +x: outline, shade, then the lit skin offset toward the thumb side,
// two finger creases and one highlight (cel-shaded like the wrestler art). Returns the key and the elbow origin.
function ensureGripSymbolTexture(scene: Phaser.Scene, R: number): { key: string; origin: { x: number; y: number } } {
  const symbol = GRIP_SUCCESS_SYMBOL
  const k = GRIP_SYMBOL_TEXTURE_SCALE
  const length = gripSuccessSymbolLengthR(symbol) * R * k
  const w = symbol.widthR * R * k
  const hr = symbol.handRadiusR * R * k
  const o = Math.max(2, GRIP_SYMBOL_OUTLINE_R * R * k)
  const tw = Math.ceil(length + hr * 2.6 + 2 * o + w + 8)
  const th = Math.ceil(Math.max(w, 2 * hr) * 2.2 + 2 * o + 8)
  const ex = w / 2 + o + 4
  const ey = th / 2 + hr * 0.15
  const hx = ex + length
  const key = `grip-symbol-${Math.round(R)}`
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    // quadratic curve elbow -> hand bulging toward -y (the thumb side)
    const curve = (t: number) => ({
      x: (1 - t) * (1 - t) * ex + 2 * (1 - t) * t * ((ex + hx) / 2) + t * t * hx,
      y: (1 - t) * (1 - t) * ey + 2 * (1 - t) * t * (ey - symbol.bend * length) + t * t * ey,
    })
    const forearm = (r: number, color: number, dy = 0) => {
      g.fillStyle(color, 1)
      for (let i = 0; i <= 40; i++) {
        const p = curve(i / 40)
        g.fillCircle(p.x, p.y + dy, r)
      }
    }
    const hand = (grow: number, color: number, dy = 0) => {
      g.fillStyle(color, 1)
      g.fillEllipse(hx + hr * 0.15, ey + dy, 2.2 * hr + 2 * grow, 2 * hr + 2 * grow)
      g.fillCircle(hx - hr * 0.15, ey - hr * 0.92 + dy, hr * 0.42 + grow)
    }
    forearm(w / 2 + o, GRIP_SYMBOL_OUTLINE)
    hand(o, GRIP_SYMBOL_OUTLINE)
    forearm(w / 2, GRIP_SYMBOL_SHADE)
    hand(0, GRIP_SYMBOL_SHADE)
    forearm((w / 2) * 0.78, GRIP_SYMBOL_SKIN, -w * 0.12)
    hand(-hr * 0.16, GRIP_SYMBOL_SKIN, -hr * 0.14)
    g.lineStyle(Math.max(2, o * 0.7), GRIP_SYMBOL_OUTLINE, 1)
    for (const k2 of [-0.35, 0.2]) g.lineBetween(hx + hr * 0.55, ey + hr * k2, hx + hr * 1.05, ey + hr * (k2 + 0.05))
    const mid = curve(0.42)
    g.fillStyle(GRIP_SYMBOL_HIGHLIGHT, 1)
    g.fillEllipse(mid.x - w * 0.08, mid.y - w * 0.26, w * 0.4, w * 0.16)
    g.generateTexture(key, tw, th)
    g.destroy()
  }
  return { key, origin: { x: ex / tw, y: ey / th } }
}

export class WrestlerView {
  private readonly shadow: Phaser.GameObjects.Image
  private readonly body: Phaser.GameObjects.Image
  private readonly sweat: Phaser.GameObjects.Image[]
  private readonly gripSymbol: Phaser.GameObjects.Image
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
    const symbolTexture = ensureGripSymbolTexture(scene, bodyRadiusPx)
    this.gripSymbol = scene.add
      .image(0, 0, symbolTexture.key)
      .setOrigin(symbolTexture.origin.x, symbolTexture.origin.y)
      .setScale(1 / GRIP_SYMBOL_TEXTURE_SCALE)
      .setDepth(GRIP_SYMBOL_DEPTH)
      .setVisible(false)
  }

  // `positionPx` is the canonical center already converted to canvas pixels; facing is applied exactly.
  // `opponentState` is only used for the pair-level Grip symbol visibility.
  apply(
    state: WrestlerVisualState,
    participant: ParticipantState,
    positionPx: { x: number; y: number },
    opponentState: WrestlerVisualState,
  ): void {
    this.moving = state.pose === 'move'
    this.show(selectWrestlerArt(this.idleArt, state))
    const display = gripSuccessDisplayOffsetPx(state, participant.facing, this.R)
    this.body
      .setPosition(positionPx.x + display.x, positionPx.y + display.y)
      .setRotation(participant.facing + counterVisualRotationOffset(this.idleArt.id, state))
    this.shadow.setPosition(
      positionPx.x + display.x + SHADOW_OFFSET.x * this.R,
      positionPx.y + display.y + SHADOW_OFFSET.y * this.R,
    )
    this.shadow.setRotation(participant.facing)
    // The opponent's grip marker on this wrestler's waist: from the displayed (offset) body center and canonical facing.
    const symbolVisible = gripSuccessPairSymbolVisible(state, opponentState)
    this.gripSymbol.setVisible(symbolVisible)
    if (symbolVisible) {
      const center = { x: positionPx.x + display.x, y: positionPx.y + display.y }
      const placed = gripSuccessSymbolPlacement(center, participant.facing, this.R)
      this.gripSymbol.setPosition(placed.elbow.x, placed.elbow.y).setRotation(placed.angle)
    }
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
