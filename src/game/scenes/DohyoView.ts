// Provisional dohyo readability pass (VISUAL-01A). Presentation only: the tawara is drawn exactly on
// the simulation ring radius (the ring-out line). Graphics only; not final arena art.
import Phaser from 'phaser'

const BACKGROUND = 0x17171d
const SAND = 0xd9c79d // janome: light sand band just outside the ring
const CLAY_OUTER = 0xbf9b62
const CLAY_INNER = 0xcdab72
const CLAY_CENTER = 0xd6b67e
const TAWARA = 0x8f6b3a
const TAWARA_MARK = 0x5f4423
const SHIKIRI = 0xf4f0e6

export function drawDohyo(
  scene: Phaser.Scene,
  center: { x: number; y: number },
  pixelsPerMeter: number,
  ringRadiusMeters: number,
): void {
  const ring = ringRadiusMeters * pixelsPerMeter
  const g = scene.add.graphics()
  g.fillStyle(BACKGROUND, 1)
  g.fillRect(0, 0, scene.scale.width, scene.scale.height)

  g.fillStyle(SAND, 1)
  g.fillCircle(center.x, center.y, ring + 0.2 * pixelsPerMeter)

  g.fillStyle(CLAY_OUTER, 1)
  g.fillCircle(center.x, center.y, ring)
  g.fillStyle(CLAY_INNER, 1)
  g.fillCircle(center.x, center.y, ring * 0.82)
  g.fillStyle(CLAY_CENTER, 1)
  g.fillCircle(center.x, center.y, ring * 0.55)

  // Tawara: thick rope ring centred on the ring-out line, with segment marks.
  const ropeWidth = Math.max(6, 0.09 * pixelsPerMeter)
  g.lineStyle(ropeWidth, TAWARA, 1)
  g.strokeCircle(center.x, center.y, ring)
  g.lineStyle(2, TAWARA_MARK, 1)
  const segments = 40
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const inner = ring - ropeWidth / 2
    const outer = ring + ropeWidth / 2
    g.lineBetween(center.x + Math.cos(a) * inner, center.y + Math.sin(a) * inner, center.x + Math.cos(a) * outer, center.y + Math.sin(a) * outer)
  }

  // Shikiri-sen: two short white starting lines, 0.35 m either side of the center.
  g.lineStyle(Math.max(3, 0.05 * pixelsPerMeter), SHIKIRI, 0.9)
  for (const side of [-1, 1]) {
    const x = center.x + side * 0.35 * pixelsPerMeter
    g.lineBetween(x, center.y - 0.4 * pixelsPerMeter, x, center.y + 0.4 * pixelsPerMeter)
  }
}
