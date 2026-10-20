// Provisional dohyo readability pass (VISUAL-01A, Tokudawara TOKUDAWARA-01A). Presentation only: the
// tawara is drawn exactly on the simulation ring-out boundary (the circle, shifted outward by the
// Tokudawara depth inside the four cardinal windows). Graphics only; not final arena art.
import Phaser from 'phaser'
import type { ArenaSetup, Vec2 } from '../sumo/BoutTypes.ts'
import { allowedArenaRadius } from '../sumo/ringOut.ts'

const BACKGROUND = 0x17171d
const SAND = 0xd9c79d // janome: light sand band just outside the ring
const CLAY_OUTER = 0xbf9b62
const CLAY_INNER = 0xcdab72
const CLAY_CENTER = 0xd6b67e
const TAWARA = 0x8f6b3a
const TAWARA_MARK = 0x5f4423
const SHIKIRI = 0xf4f0e6
const DEBUG_BOUNDARY = 0xff3355

// Drawing resolution of the boundary arcs (presentation only; window edges are exact vertices).
const ARC_STEP = Math.PI / 360

function arcPoints(radius: number, from: number, to: number, out: Vec2[]): void {
  const steps = Math.max(1, Math.ceil((to - from) / ARC_STEP))
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  }
}

// The ring-out boundary as a closed polyline in meters: Tokudawara arcs at radius + depth, normal arcs
// at radius, joined by the radial side segments at the window edges.
export function arenaBoundaryOutline(arena: ArenaSetup): Vec2[] {
  const points: Vec2[] = []
  const t = arena.tokudawara
  if (!t) {
    arcPoints(arena.radius, 0, Math.PI * 2, points)
    return points
  }
  for (let k = 0; k < 4; k++) {
    const axis = (k * Math.PI) / 2
    arcPoints(arena.radius + t.depth, axis - t.halfAngle, axis + t.halfAngle, points)
    arcPoints(arena.radius, axis + t.halfAngle, axis + Math.PI / 2 - t.halfAngle, points)
  }
  return points
}

function toCanvas(points: readonly Vec2[], center: Vec2, pixelsPerMeter: number): Phaser.Math.Vector2[] {
  return points.map((p) => new Phaser.Math.Vector2(center.x + p.x * pixelsPerMeter, center.y + p.y * pixelsPerMeter))
}

export function drawDohyo(scene: Phaser.Scene, center: Vec2, pixelsPerMeter: number, arena: ArenaSetup): void {
  const ring = arena.radius * pixelsPerMeter
  const outline = toCanvas(arenaBoundaryOutline(arena), center, pixelsPerMeter)
  const g = scene.add.graphics()
  g.fillStyle(BACKGROUND, 1)
  g.fillRect(0, 0, scene.scale.width, scene.scale.height)

  g.fillStyle(SAND, 1)
  g.fillCircle(center.x, center.y, ring + 0.2 * pixelsPerMeter)

  g.fillStyle(CLAY_OUTER, 1)
  g.fillPoints(outline, true)
  g.fillStyle(CLAY_INNER, 1)
  g.fillCircle(center.x, center.y, ring * 0.82)
  g.fillStyle(CLAY_CENTER, 1)
  g.fillCircle(center.x, center.y, ring * 0.55)

  // Tawara: thick rope centred on the ring-out boundary, with segment marks.
  const ropeWidth = Math.max(6, 0.09 * pixelsPerMeter)
  g.lineStyle(ropeWidth, TAWARA, 1)
  g.strokePoints(outline, true)
  g.lineStyle(2, TAWARA_MARK, 1)
  const segments = 40
  for (let i = 0; i < segments; i++) {
    // Half-step offset keeps marks off the Tokudawara window edges.
    const a = ((i + 0.5) / segments) * Math.PI * 2
    const r = allowedArenaRadius({ x: Math.cos(a), y: Math.sin(a) }, arena) * pixelsPerMeter
    const inner = r - ropeWidth / 2
    const outer = r + ropeWidth / 2
    g.lineBetween(center.x + Math.cos(a) * inner, center.y + Math.sin(a) * inner, center.x + Math.cos(a) * outer, center.y + Math.sin(a) * outer)
  }

  // Shikiri-sen: two short white starting lines, 0.35 m either side of the center.
  g.lineStyle(Math.max(3, 0.05 * pixelsPerMeter), SHIKIRI, 0.9)
  for (const side of [-1, 1]) {
    const x = center.x + side * 0.35 * pixelsPerMeter
    g.lineBetween(x, center.y - 0.4 * pixelsPerMeter, x, center.y + 0.4 * pixelsPerMeter)
  }
}

// Debug overlay: the exact center ring-out boundary as a thin line (shown with the debug toggle).
export function drawArenaBoundaryDebug(scene: Phaser.Scene, center: Vec2, pixelsPerMeter: number, arena: ArenaSetup): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  g.lineStyle(2, DEBUG_BOUNDARY, 1)
  g.strokePoints(toCanvas(arenaBoundaryOutline(arena), center, pixelsPerMeter), true)
  return g
}
