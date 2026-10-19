// Provisional articulated top-down wrestler (VISUAL-01A). Presentation only: it mirrors the canonical
// Snapshot (position / facing are applied exactly) and a pure WrestlerVisualState; it never changes
// gameplay. Parts are textures generated at runtime from Phaser Graphics (no asset files).
import Phaser from 'phaser'
import type { WrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import type { ParticipantState } from '../sumo/BoutTypes.ts'

// Provisional palette (validation visuals, not a final art style).
const SKIN = 0xe9c19c
const SKIN_SHADE = 0xd3a57d
const OUTLINE = 0x6b4128
const HAIR = 0x1d1a1a

// Pose parameters in units of the body radius R (local frame: +x = facing / front, +y = right side).
interface PoseParams {
  lean: number // torso offset along +x
  torsoRot: number // rad, torso + head + arms
  crouch: number // torso scale
  spreadL: number // rad, left arm turned outward (toward -y)
  spreadR: number // rad, right arm turned outward (toward +y)
  reachL: number // arm length factor
  reachR: number
  stance: number // half distance between the feet (sideways)
  footL: number // forward offset of the left foot
  footR: number
}

const IDLE: PoseParams = {
  lean: 0, torsoRot: 0, crouch: 1, spreadL: 0.55, spreadR: 0.55, reachL: 0.75, reachR: 0.75, stance: 0.5, footL: 0.04, footR: -0.04,
}
const PUSH_STARTUP: PoseParams = {
  lean: -0.12, torsoRot: 0, crouch: 0.95, spreadL: 0.2, spreadR: 0.2, reachL: 0.5, reachR: 0.5, stance: 0.6, footL: 0.15, footR: -0.22,
}
const PUSH_ACTIVE: PoseParams = {
  lean: 0.28, torsoRot: 0, crouch: 1, spreadL: 0.06, spreadR: 0.06, reachL: 1.3, reachR: 1.3, stance: 0.55, footL: 0.25, footR: -0.32,
}
const COUNTER: PoseParams = {
  lean: -0.1, torsoRot: 0, crouch: 0.93, spreadL: 1.05, spreadR: 1.05, reachL: 0.8, reachR: 0.8, stance: 0.68, footL: 0.06, footR: -0.06,
}
const GRIP_REACH: PoseParams = {
  lean: 0.15, torsoRot: 0, crouch: 1, spreadL: 0.25, spreadR: 0.25, reachL: 1.2, reachR: 1.2, stance: 0.55, footL: 0.12, footR: -0.12,
}
// Neutral clinch (yotsu-like): one arm over (wider), one arm inside (narrow, deeper).
const GRAPPLE_NEUTRAL: PoseParams = {
  lean: 0.1, torsoRot: 0, crouch: 1, spreadL: 0.34, spreadR: 0.1, reachL: 1.35, reachR: 1.5, stance: 0.6, footL: 0.1, footR: -0.15,
}
// Morozashi holder: both arms inside and deep.
const MOROZASHI_HOLDER: PoseParams = {
  lean: 0.16, torsoRot: 0, crouch: 1, spreadL: 0.08, spreadR: 0.08, reachL: 1.55, reachR: 1.55, stance: 0.62, footL: 0.12, footR: -0.16,
}
// Morozashi disadvantaged: both arms pushed outside and up, standing taller.
const MOROZASHI_HELD: PoseParams = {
  lean: 0, torsoRot: 0, crouch: 1.03, spreadL: 0.95, spreadR: 0.95, reachL: 1.15, reachR: 1.15, stance: 0.5, footL: 0.02, footR: -0.06,
}
// Grappled but still turning: arms not established (hanging out sideways).
const TURNING: PoseParams = {
  lean: -0.03, torsoRot: 0, crouch: 1, spreadL: 0.8, spreadR: 0.8, reachL: 0.55, reachR: 0.55, stance: 0.5, footL: 0, footR: 0,
}

function mix(a: PoseParams, b: PoseParams, t: number): PoseParams {
  const out = { ...a }
  for (const key of Object.keys(a) as (keyof PoseParams)[]) out[key] = a[key] + (b[key] - a[key]) * t
  return out
}

export const WRESTLER_SHADOW_DEPTH = 1
export const WRESTLER_BODY_DEPTH = 2

const POSE_SMOOTHING_RATE = 18 // 1/s, presentation-only easing toward the target pose
const WALK_STRIDE = 0.55 // R per half step cycle
const SHUFFLE_HZ = 4.5 // in-place feet shuffle while turning / driving

function textureKeys(radius: number) {
  const r = Math.round(radius)
  return {
    shadow: `wrestler-shadow-${r}`,
    foot: `wrestler-foot-${r}`,
    torso: `wrestler-torso-${r}`,
    mawashi: `wrestler-mawashi-${r}`,
    arm: `wrestler-arm-${r}`,
    head: `wrestler-head-${r}`,
  }
}

// Draws each part once into the Texture Manager (Graphics.generateTexture). White parts are tinted.
function ensureTextures(scene: Phaser.Scene, R: number): ReturnType<typeof textureKeys> {
  const keys = textureKeys(R)
  if (scene.textures.exists(keys.torso)) return keys
  const g = scene.make.graphics({ x: 0, y: 0 }, false)
  const make = (key: string, w: number, h: number, draw: () => void) => {
    g.clear()
    draw()
    g.generateTexture(key, Math.ceil(w), Math.ceil(h))
  }

  const shadowW = 2.6 * R
  make(keys.shadow, shadowW, shadowW, () => {
    g.fillStyle(0x000000, 0.28)
    g.fillEllipse(shadowW / 2, shadowW / 2, 2.25 * R, 2.0 * R)
  })

  const footW = 0.6 * R
  const footH = 0.42 * R
  make(keys.foot, footW, footH, () => {
    g.fillStyle(SKIN_SHADE, 1)
    g.lineStyle(2, OUTLINE, 1)
    g.fillEllipse(footW / 2, footH / 2, 0.5 * R, 0.32 * R)
    g.strokeEllipse(footW / 2, footH / 2, 0.5 * R, 0.32 * R)
  })

  // Torso: wider shoulder-to-shoulder (y) than front-to-back (x).
  const torsoW = 2.2 * R
  make(keys.torso, torsoW, torsoW, () => {
    g.fillStyle(SKIN, 1)
    g.lineStyle(3, OUTLINE, 1)
    g.fillEllipse(torsoW / 2, torsoW / 2, 1.6 * R, 2.0 * R)
    g.strokeEllipse(torsoW / 2, torsoW / 2, 1.6 * R, 2.0 * R)
    g.fillStyle(SKIN_SHADE, 1) // belly toward the front
    g.fillEllipse(torsoW / 2 + 0.28 * R, torsoW / 2, 0.7 * R, 1.1 * R)
  })

  // Mawashi seen from above: a band around the rear half of the torso plus the rear knot (white -> tint).
  make(keys.mawashi, torsoW, torsoW, () => {
    const cx = torsoW / 2
    const cy = torsoW / 2
    const points: Phaser.Math.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / 24 // rear half (x < 0)
      points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * 0.8 * R, cy + Math.sin(a) * 1.0 * R))
    }
    g.lineStyle(0.22 * R, 0xffffff, 1)
    g.strokePoints(points, false)
    g.fillStyle(0xffffff, 1)
    g.fillRoundedRect(cx - 1.02 * R, cy - 0.2 * R, 0.34 * R, 0.4 * R, 0.08 * R)
  })

  // Arm: capsule from the shoulder (texture left edge) toward +x, hand at the end.
  const armLen = 1.2 * R
  const armH = 0.56 * R
  make(keys.arm, armLen + 0.3 * R, armH, () => {
    g.fillStyle(SKIN, 1)
    g.lineStyle(2, OUTLINE, 1)
    g.fillRoundedRect(0.02 * R, armH / 2 - 0.17 * R, armLen, 0.34 * R, 0.17 * R)
    g.strokeRoundedRect(0.02 * R, armH / 2 - 0.17 * R, armLen, 0.34 * R, 0.17 * R)
    g.fillCircle(armLen, armH / 2, 0.24 * R)
    g.strokeCircle(armLen, armH / 2, 0.24 * R)
  })

  // Head: hair on the back half, forehead skin toward the front, mage (topknot) at the back.
  const headW = 1.1 * R
  make(keys.head, headW, headW, () => {
    const c = headW / 2
    g.fillStyle(HAIR, 1)
    g.fillCircle(c - 0.04 * R, c, 0.42 * R)
    g.fillStyle(SKIN, 1)
    g.fillCircle(c + 0.07 * R, c, 0.34 * R)
    g.lineStyle(2, OUTLINE, 1)
    g.strokeCircle(c - 0.04 * R, c, 0.42 * R)
    g.fillStyle(HAIR, 1)
    g.fillEllipse(c - 0.42 * R, c, 0.3 * R, 0.22 * R)
  })
  g.destroy()
  return keys
}

export class WrestlerView {
  private readonly shadow: Phaser.GameObjects.Image
  private readonly root: Phaser.GameObjects.Container
  private readonly footL: Phaser.GameObjects.Image
  private readonly footR: Phaser.GameObjects.Image
  private readonly torso: Phaser.GameObjects.Image
  private readonly mawashi: Phaser.GameObjects.Image
  private readonly armL: Phaser.GameObjects.Image
  private readonly armR: Phaser.GameObjects.Image
  private readonly head: Phaser.GameObjects.Image
  private readonly R: number
  private readonly color: number
  private pose: PoseParams = { ...IDLE }
  private time = 0
  private walkPhase = 0
  // Presentation-only memory for the idle / move hysteresis (not gameplay state).
  moving = false

  constructor(scene: Phaser.Scene, bodyRadiusPx: number, color: number) {
    this.R = bodyRadiusPx
    this.color = color
    const keys = ensureTextures(scene, bodyRadiusPx)
    this.shadow = scene.add.image(0, 0, keys.shadow)
    this.footL = scene.add.image(0, 0, keys.foot)
    this.footR = scene.add.image(0, 0, keys.foot)
    this.torso = scene.add.image(0, 0, keys.torso)
    this.mawashi = scene.add.image(0, 0, keys.mawashi).setTint(color)
    const armOriginX = (0.02 * bodyRadiusPx) / (1.5 * bodyRadiusPx)
    this.armL = scene.add.image(0, 0, keys.arm).setOrigin(armOriginX, 0.5)
    this.armR = scene.add.image(0, 0, keys.arm).setOrigin(armOriginX, 0.5)
    this.head = scene.add.image(0, 0, keys.head)
    this.root = scene.add.container(0, 0, [this.footL, this.footR, this.torso, this.mawashi, this.armL, this.armR, this.head])
    // Shadows below both wrestlers, bodies above the shadows (debug overlays / texts sit higher).
    this.shadow.setDepth(WRESTLER_SHADOW_DEPTH)
    this.root.setDepth(WRESTLER_BODY_DEPTH)
  }

  // `positionPx` is the canonical center already converted to canvas pixels; facing is applied exactly.
  apply(state: WrestlerVisualState, participant: ParticipantState, positionPx: { x: number; y: number }, dtMs: number): void {
    const dt = state.frozen ? 0 : dtMs / 1000
    this.time += dt
    this.moving = state.pose === 'move'

    const target = this.targetPose(state)
    const k = dtMs <= 0 ? 1 : state.frozen ? 0 : 1 - Math.exp(-POSE_SMOOTHING_RATE * dt)
    this.pose = mix(this.pose, target, k)

    // Feet: walking advances by distance travelled (no sliding); turning / driving shuffles in place.
    const local = this.localDirection(participant)
    let strideX = 0
    let strideY = 0
    if (state.pose === 'move') {
      this.walkPhase += (state.locomotionSpeed * dt * Math.PI) / (WALK_STRIDE * this.metersPerR(participant))
      const s = Math.sin(this.walkPhase) * 0.24
      strideX = local.x * s
      strideY = local.y * s
    } else if (state.pose === 'drive' || state.turning) {
      const s = Math.sin(this.time * Math.PI * 2 * SHUFFLE_HZ) * (state.pose === 'drive' ? 0.14 : 0.1)
      strideX = s
    }
    this.layout(this.pose, state, strideX, strideY)

    this.root.setPosition(positionPx.x, positionPx.y)
    this.root.setRotation(participant.facing)
    this.shadow.setPosition(positionPx.x + 0.07 * this.R, positionPx.y + 0.12 * this.R)
    this.shadow.setRotation(participant.facing)
    // The Morozashi holder's mawashi reads brighter (established advantage); others use the team color.
    this.mawashi.setTint(state.grappleRole === 'morozashi-holder' ? lighten(this.color, 0.45) : this.color)
  }

  private metersPerR(participant: ParticipantState): number {
    return participant.bodyRadius
  }

  // Own footwork direction in the wrestler's local frame (unit, or zero when standing).
  private localDirection(participant: ParticipantState): { x: number; y: number } {
    const vx = participant.velocity.x - participant.externalVelocity.x
    const vy = participant.velocity.y - participant.externalVelocity.y
    const speed = Math.hypot(vx, vy)
    if (speed < 1e-6) return { x: 1, y: 0 }
    const c = Math.cos(-participant.facing)
    const s = Math.sin(-participant.facing)
    return { x: (vx * c - vy * s) / speed, y: (vx * s + vy * c) / speed }
  }

  private targetPose(state: WrestlerVisualState): PoseParams {
    const p = state.phaseProgress
    switch (state.pose) {
      case 'push':
        if (state.pushPhase === 'startup') return mix(IDLE, PUSH_STARTUP, Math.min(1, 0.4 + p))
        if (state.pushPhase === 'active') return PUSH_ACTIVE
        return mix(PUSH_ACTIVE, IDLE, p)
      case 'counter':
        return COUNTER
      case 'grip':
        return state.gripPhase === 'reach' ? GRIP_REACH : mix(GRIP_REACH, IDLE, p)
      case 'kuzushi': {
        const s = Math.max(0.35, state.kuzushiStrength)
        const t = this.time
        return {
          lean: 0.06 * Math.sin(t * 7) * s,
          torsoRot: (0.12 + 0.16 * Math.sin(t * 5.2)) * s,
          crouch: 0.97,
          spreadL: 1.3 + 0.28 * Math.sin(t * 9),
          spreadR: 1.15 + 0.28 * Math.sin(t * 9 + 1.3),
          reachL: 0.95,
          reachR: 0.85,
          stance: 0.64,
          footL: 0.32 * s,
          footR: -0.26 * s,
        }
      }
      case 'grapple':
      case 'drive': {
        if (state.turning) return TURNING
        const base =
          state.grappleRole === 'morozashi-holder'
            ? MOROZASHI_HOLDER
            : state.grappleRole === 'morozashi-disadvantaged'
              ? MOROZASHI_HELD
              : GRAPPLE_NEUTRAL
        return state.pose === 'drive' ? { ...base, lean: base.lean + 0.12, crouch: base.crouch * 0.97, stance: base.stance + 0.06 } : base
      }
      case 'move':
      case 'idle':
      default:
        return { ...IDLE, crouch: 1 + 0.012 * Math.sin(this.time * 2.2) }
    }
  }

  private layout(p: PoseParams, state: WrestlerVisualState, strideX: number, strideY: number): void {
    const R = this.R
    // Feet stay planted relative to the body center (canonical position), only the pose moves them.
    this.footL.setPosition((p.footL + strideX) * R, (-p.stance + strideY) * R)
    this.footR.setPosition((p.footR - strideX) * R, (p.stance - strideY) * R)
    this.footL.setRotation(0)
    this.footR.setRotation(0)

    const cos = Math.cos(p.torsoRot)
    const sin = Math.sin(p.torsoRot)
    const at = (x: number, y: number) => ({ x: (x * cos - y * sin) * R + p.lean * R, y: (x * sin + y * cos) * R })

    const torso = at(0, 0)
    this.torso.setPosition(torso.x, torso.y).setRotation(p.torsoRot).setScale(p.crouch)
    this.mawashi.setPosition(torso.x, torso.y).setRotation(p.torsoRot).setScale(p.crouch)

    const shoulderL = at(0.1, -0.8 * p.crouch)
    const shoulderR = at(0.1, 0.8 * p.crouch)
    this.armL.setPosition(shoulderL.x, shoulderL.y).setRotation(p.torsoRot - p.spreadL).setScale(p.reachL, 1)
    this.armR.setPosition(shoulderR.x, shoulderR.y).setRotation(p.torsoRot + p.spreadR).setScale(p.reachR, 1)

    const head = at(0.3 + (state.pose === 'push' && state.pushPhase === 'active' ? 0.08 : 0), 0)
    this.head.setPosition(head.x, head.y).setRotation(p.torsoRot)
  }
}

function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const up = (c: number) => Math.round(c + (255 - c) * amount)
  return (up(r) << 16) | (up(g) << 8) | up(b)
}
