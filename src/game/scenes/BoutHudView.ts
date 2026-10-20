// Product Bout HUD shell (ACTION-ART-02A / 02A1, docs/ACTION_HUD_PRODUCT_SPEC.md §3 / §7). Presentation
// only: East / West identity blocks (side label, rank, name, current record) and the Day chip, drawn with
// simple primitives from the pure HUD context and UI copy (English release baseline). Reads no Simulation
// state. Layout and colors are Provisional values for User Visual Check.
import Phaser from 'phaser'
import type { BoutHudCopy } from '../presentation/boutHudCopy.ts'
import { formatRecord, hudWrestlerBySide, type BoutHudContext, type BoutHudWrestler } from '../presentation/boutHudPresentation.ts'
import { BORDER, CORNER, SIDE_ACCENT, inkText, paperPanel, setFitted, sidePill, type Rect } from './HudStyle.ts'

// Above wrestlers (1, 2) and debug overlays (3).
export const HUD_DEPTH = 4

// Provisional zones (spec §7.2); all outside the Action critical circle (r = 483 around (960, 540)).
const EAST_BLOCK: Rect = { x: 24, y: 24, w: 440, h: 150 }
const WEST_BLOCK: Rect = { x: 1456, y: 24, w: 440, h: 150 }
const DAY_CHIP: Rect = { x: 810, y: 10, w: 300, h: 44 }

const ACCENT_BAND = 10
const PADDING = 16
const SIDE_PILL_GAP = 12

// Font sizes (logical px): preferred -> minimum before ellipsis (spec §14).
const RANK_SIZE = { preferred: 30, min: 28 }
const NAME_SIZE = { preferred: 48, min: 36 }
const RECORD_SIZE = 32
const DAY_SIZE = 30

// Row centers inside an identity block.
const ROW_TOP = 32
const ROW_NAME = 84
const ROW_RECORD = 128

function panel(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, rect: Rect): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  layer.add(g)
  paperPanel(g, rect)
  return g
}

// One identity block; West mirrors East (accent band and side pill on the outer edge, text aligned to it).
function identityBlock(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, rect: Rect, wrestler: BoutHudWrestler, copy: BoutHudCopy): void {
  const east = wrestler.side === 'east'
  const g = panel(scene, layer, rect)
  const bandX = east ? rect.x + BORDER : rect.x + rect.w - BORDER - ACCENT_BAND
  g.fillStyle(SIDE_ACCENT[wrestler.side], 1)
  g.fillRect(bandX, rect.y + BORDER + CORNER, ACCENT_BAND, rect.h - 2 * (BORDER + CORNER))

  // Content edge on the outer side (left for East, right for West) and its direction inward.
  const outer = east ? rect.x + ACCENT_BAND + PADDING : rect.x + rect.w - ACCENT_BAND - PADDING
  const inward = east ? 1 : -1
  const originX = east ? 0 : 1
  const contentWidth = rect.w - ACCENT_BAND - 2 * PADDING

  // Row 1: side label pill (full word, so color is not the only cue) + rank.
  const pillW = sidePill(scene, layer, g, copy, wrestler.side, outer, rect.y + ROW_TOP, east ? 'left' : 'right')
  const rank = inkText(scene, layer, RANK_SIZE.preferred).setOrigin(originX, 0.5)
  setFitted(rank, wrestler.rankLabel, contentWidth - pillW - SIDE_PILL_GAP, RANK_SIZE)
  rank.setPosition(outer + inward * (pillW + SIDE_PILL_GAP), rect.y + ROW_TOP)

  // Row 2: name, the dominant text.
  const name = inkText(scene, layer, NAME_SIZE.preferred).setOrigin(originX, 0.5).setFontStyle('bold')
  setFitted(name, wrestler.name, contentWidth, NAME_SIZE)
  name.setPosition(outer, rect.y + ROW_NAME)

  // Row 3: current basho record.
  inkText(scene, layer, RECORD_SIZE)
    .setText(formatRecord(wrestler.record))
    .setOrigin(originX, 0.5)
    .setPosition(outer, rect.y + ROW_RECORD)
}

function dayChip(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, rect: Rect, day: number, copy: BoutHudCopy): void {
  panel(scene, layer, rect)
  inkText(scene, layer, DAY_SIZE)
    .setText(copy.formatDay(day))
    .setOrigin(0.5)
    .setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2)
}

// Creates the static always-visible HUD shell as one layer (toggle with setVisible). The context is
// validated against the bout participants by the caller.
export function createBoutHud(scene: Phaser.Scene, context: BoutHudContext, copy: BoutHudCopy): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0).setDepth(HUD_DEPTH)
  identityBlock(scene, layer, EAST_BLOCK, hudWrestlerBySide(context, 'east'), copy)
  identityBlock(scene, layer, WEST_BLOCK, hudWrestlerBySide(context, 'west'), copy)
  dayChip(scene, layer, DAY_CHIP, context.day, copy)
  return layer
}
