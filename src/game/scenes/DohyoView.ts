// Product dohyo presentation (ACTION-ART-01B). The visible dohyo is the accepted Product art from
// tools/dohyo_art (Candidate C): the painted arena base plus the exact tawara / Tokudawara overlay, both
// 1920x1080 and drawn 1:1 at the art center. Presentation only; the Simulation Snapshot stays the
// gameplay geometry source of truth, and the debug boundary below draws that geometry over the art.
import Phaser from 'phaser'
import type { ArenaSetup, Vec2 } from '../sumo/BoutTypes.ts'

const PRODUCT_ARENA_BASE_KEY = 'product-arena-base'
const PRODUCT_DOHYO_OVERLAY_KEY = 'product-dohyo-overlay'
const ASSET_DIR = `${import.meta.env.BASE_URL}assets/action/background/`

// Below the wrestler shadow (1) and body (2) depths.
const PRODUCT_ARENA_BASE_DEPTH = 0
const PRODUCT_DOHYO_OVERLAY_DEPTH = 0.5

const DEBUG_BOUNDARY = 0xff00ff // high contrast against clay and straw
const DEBUG_BOUNDARY_WIDTH = 3

// Drawing resolution of the boundary arcs (presentation only; window edges are exact vertices).
const ARC_STEP = Math.PI / 720

export function preloadProductDohyo(scene: Phaser.Scene): void {
  scene.load.image(PRODUCT_ARENA_BASE_KEY, `${ASSET_DIR}arena_base_1920.png`)
  scene.load.image(PRODUCT_DOHYO_OVERLAY_KEY, `${ASSET_DIR}dohyo_ring_overlay_1920.png`)
}

// Places both Product layers with their centers on the art center (the Simulation origin).
export function addProductDohyo(scene: Phaser.Scene, artCenter: Vec2): void {
  scene.add.image(artCenter.x, artCenter.y, PRODUCT_ARENA_BASE_KEY).setOrigin(0.5).setDepth(PRODUCT_ARENA_BASE_DEPTH)
  scene.add.image(artCenter.x, artCenter.y, PRODUCT_DOHYO_OVERLAY_KEY).setOrigin(0.5).setDepth(PRODUCT_DOHYO_OVERLAY_DEPTH)
}

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

// Debug overlay: the exact Simulation center ring-out boundary as a thin line over the Product art
// (shown with the debug toggle) to verify art <-> Simulation alignment.
export function drawArenaBoundaryDebug(scene: Phaser.Scene, center: Vec2, pixelsPerMeter: number, arena: ArenaSetup): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  g.lineStyle(DEBUG_BOUNDARY_WIDTH, DEBUG_BOUNDARY, 1)
  g.strokePoints(
    arenaBoundaryOutline(arena).map((p) => new Phaser.Math.Vector2(center.x + p.x * pixelsPerMeter, center.y + p.y * pixelsPerMeter)),
    true,
  )
  return g
}
