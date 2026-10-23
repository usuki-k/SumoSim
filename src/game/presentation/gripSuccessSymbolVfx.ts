// Grip success hand marker VFX Visual Gate (ACTION-11K symbolic markers; ACTION-11L authored art). Provisional,
// presentation-only; not an accepted Product art contract. Pure TypeScript; must not import Phaser.
// Like the Kuzushi sweat, this is a symbol, not anatomy: a User-authored forearm + fist illustration laid over the waist
// / mawashi of the wrestler being gripped, not connected to the gripping wrestler's body. Each wrestler's view draws the
// two markers that land on ITS OWN waist (the opponent's two hands), so a READY pair shows exactly four. Placement is
// target-local in units of the body radius R (+forward = FRONT, -forward = BACK / mawashi knot, +lateral = wrestler
// RIGHT) from the target's displayed body center (canonical + Grip success display offset) and its canonical facing:
// the fist (hand anchor) sits on the mawashi. The two markers of a wrestler differ by the side of its success art
// (ACTION-11M). On the head side (the visually upper marker of a settled pair) the forearm crosses the waist band at
// about 37 degrees with the elbow outside the waist and the upper-arm stub curling toward the pair contact (ACTION-11L
// layout). On the foot side (the visually lower marker; ACTION-11N, after the User reference) the forearm runs forward
// along the lower flank from the mawashi to an elbow in front, the reflected art putting the upper-arm bulge on the
// outer edge, so it reads as reaching from the target's front shoulder down to its mawashi; anatomical attachment is
// not intended. The blue success art is the red one reflected across the local X axis, so its head / foot sides (and
// marker set) are the red ones mirrored laterally. The geometry
// assumes an aligned pair: shown only while both wrestlers are in the success pose and neither is TURNING (ACTION-11J
// rule). No timer, no fade, no animation.
import { isGripSuccessPose } from './gripSuccessGateArt.ts'
import type { ProductWrestlerArtId } from './productWrestlerArt.ts'
import type { WrestlerVisualState } from './wrestlerVisualState.ts'

export type GripMarkerSide = 'left' | 'right'
// Which side of the wrestler's success art the marker sits on (head side = visually upper in a settled pair).
export type GripMarkerRole = 'headSide' | 'footSide'
export type GripMarkerArtId = 'authored' | 'mirrored'

// One runtime texture with its hand (fist center) and elbow anchors in texture px
// (tools/wrestler_art/export_grip_forearm_hand_gate.py; checked by its Python tests).
export interface GripMarkerArt {
  readonly id: GripMarkerArtId
  readonly textureKey: string
  readonly assetPath: string
  readonly width: number
  readonly height: number
  readonly hand: { readonly x: number; readonly y: number }
  readonly elbow: { readonly x: number; readonly y: number }
}

export const GRIP_MARKER_ART: Readonly<Record<GripMarkerArtId, GripMarkerArt>> = {
  authored: {
    id: 'authored',
    textureKey: 'grip-symbol-authored',
    assetPath: 'assets/action/wrestler/grip-symbol-authored-gate/forearm_hand.png',
    width: 94,
    height: 59,
    hand: { x: 15.875, y: 42.125 },
    elbow: { x: 73.1875, y: 30.5625 },
  },
  mirrored: {
    id: 'mirrored',
    textureKey: 'grip-symbol-authored-mirrored',
    assetPath: 'assets/action/wrestler/grip-symbol-authored-gate/forearm_hand_mirrored.png',
    width: 94,
    height: 59,
    hand: { x: 15.875, y: 16.875 }, // authored anchors reflected: y -> 59 - y
    elbow: { x: 73.1875, y: 28.4375 },
  },
}

export function allGripMarkerArts(): GripMarkerArt[] {
  return [GRIP_MARKER_ART.authored, GRIP_MARKER_ART.mirrored]
}

export interface GripSuccessMarker {
  readonly role: GripMarkerRole
  readonly side: GripMarkerSide
  readonly art: GripMarkerArtId
  readonly handForwardR: number // fist center, on the mawashi
  readonly handLateralR: number
  readonly elbowForwardR: number // forearm end
  readonly elbowLateralR: number
}

// Per target art: [head side (ACTION-11L), foot side (ACTION-11N)].
// Head side elbow -> hand (-0.42, +/-0.56): 0.70 R, 36.87 degrees off the target's local lateral (waist band) axis.
// Foot side elbow -> hand (-0.68, +/-0.17): 0.70 R, 75.96 degrees off that axis (forward along the lower flank).
// The red head side is its RIGHT (+lateral), the foot side its LEFT; blue (reflected) is the opposite.
export const GRIP_SUCCESS_MARKERS: Readonly<Record<ProductWrestlerArtId, readonly GripSuccessMarker[]>> = {
  red: [
    { role: 'headSide', side: 'right', art: 'authored', handForwardR: -0.45, handLateralR: 0.62, elbowForwardR: -0.03, elbowLateralR: 1.18 },
    { role: 'footSide', side: 'left', art: 'mirrored', handForwardR: -0.45, handLateralR: -0.62, elbowForwardR: 0.23, elbowLateralR: -0.79 },
  ],
  blue: [
    { role: 'headSide', side: 'left', art: 'mirrored', handForwardR: -0.45, handLateralR: -0.62, elbowForwardR: -0.03, elbowLateralR: -1.18 },
    { role: 'footSide', side: 'right', art: 'authored', handForwardR: -0.45, handLateralR: 0.62, elbowForwardR: 0.23, elbowLateralR: 0.79 },
  ],
}

export function gripMarkerLengthR(marker: GripSuccessMarker): number {
  return Math.hypot(marker.handForwardR - marker.elbowForwardR, marker.handLateralR - marker.elbowLateralR)
}

// Angle (degrees) between the elbow -> hand direction and the target's local lateral axis (the mawashi band).
export function gripMarkerWaistAngleDeg(marker: GripSuccessMarker): number {
  const df = Math.abs(marker.handForwardR - marker.elbowForwardR)
  const dl = Math.abs(marker.handLateralR - marker.elbowLateralR)
  return (Math.atan2(df, dl) * 180) / Math.PI
}

// Pair-level visibility (same answer for both wrestlers): success pose on both sides and neither TURNING.
export function gripSuccessPairSymbolVisible(self: WrestlerVisualState, opponent: WrestlerVisualState): boolean {
  return isGripSuccessPose(self) && isGripSuccessPose(opponent) && !self.turning && !opponent.turning
}

export interface GripMarkerPlacement {
  readonly art: GripMarkerArt
  readonly hand: { x: number; y: number } // canvas px; the texture origin is the hand anchor
  readonly elbow: { x: number; y: number }
  readonly rotation: number // canvas radians applied to the texture
  readonly scale: number // uniform texture scale
  readonly lengthPx: number // displayed elbow -> hand distance
}

function localToCanvas(
  center: { x: number; y: number },
  forwardR: number,
  lateralR: number,
  facing: number,
  bodyRadiusPx: number,
): { x: number; y: number } {
  const c = Math.cos(facing)
  const s = Math.sin(facing)
  const f = forwardR * bodyRadiusPx
  const l = lateralR * bodyRadiusPx
  return { x: center.x + f * c - l * s, y: center.y + f * s + l * c }
}

// Canvas placement of one marker on a target wrestler from its displayed body center (px) and canonical facing:
// the texture's hand anchor sits on the hand point and its elbow -> hand axis follows the marker direction.
export function gripMarkerPlacement(
  marker: GripSuccessMarker,
  targetDisplayCenterPx: { x: number; y: number },
  targetFacing: number,
  bodyRadiusPx: number,
): GripMarkerPlacement {
  const art = GRIP_MARKER_ART[marker.art]
  const hand = localToCanvas(targetDisplayCenterPx, marker.handForwardR, marker.handLateralR, targetFacing, bodyRadiusPx)
  const elbow = localToCanvas(targetDisplayCenterPx, marker.elbowForwardR, marker.elbowLateralR, targetFacing, bodyRadiusPx)
  const lengthPx = Math.hypot(hand.x - elbow.x, hand.y - elbow.y)
  const texDx = art.hand.x - art.elbow.x
  const texDy = art.hand.y - art.elbow.y
  return {
    art,
    hand,
    elbow,
    rotation: Math.atan2(hand.y - elbow.y, hand.x - elbow.x) - Math.atan2(texDy, texDx),
    scale: lengthPx / Math.hypot(texDx, texDy),
    lengthPx,
  }
}
