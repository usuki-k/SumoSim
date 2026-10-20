// Product Bout HUD shell (ACTION-ART-02A / 02A1, docs/ACTION_HUD_PRODUCT_SPEC.md §3 / §7). Presentation
// only: East / West identity blocks (side label, rank, name, current record) and the Day chip, drawn with
// simple primitives from the pure HUD context and UI copy (English release baseline). Reads no Simulation
// state. Layout and colors are Provisional values for User Visual Check.
import Phaser from 'phaser'
import { sideLabel, type BoutHudCopy } from '../presentation/boutHudCopy.ts'
import {
  fitSingleLine,
  formatRecord,
  hudWrestlerBySide,
  type BoutHudContext,
  type BoutHudWrestler,
  type BoutSide,
} from '../presentation/boutHudPresentation.ts'

// Above wrestlers (1, 2) and debug overlays (3).
export const HUD_DEPTH = 4

interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

// Provisional zones (spec §7.2); all outside the Action critical circle (r = 483 around (960, 540)).
const EAST_BLOCK: Rect = { x: 24, y: 24, w: 440, h: 150 }
const WEST_BLOCK: Rect = { x: 1456, y: 24, w: 440, h: 150 }
const DAY_CHIP: Rect = { x: 810, y: 10, w: 300, h: 44 }

// Provisional palette (spec §6): paper panel, ink text, subdued side accents.
const PAPER = 0xf2e8d5
const PAPER_ALPHA = 0.93
const INK = 0x1f1a16
const INK_CSS = '#1f1a16'
const PAPER_CSS = '#f6eedf'
const BORDER_ALPHA = 0.85
const SIDE_ACCENT: Record<BoutSide, number> = { east: 0x34507a, west: 0xa3452f }

// Latin system serif stack (no font asset); provisional until Product typography work.
const FONT_FAMILY = 'Georgia, "Times New Roman", Times, serif'
const CORNER = 6
const BORDER = 2
const ACCENT_BAND = 10
const PADDING = 16
// Side label pill: sized to the measured full word (East / West), at least SIDE_PILL_MIN_W wide.
const SIDE_PILL_H = 36
const SIDE_PILL_PAD_X = 12
const SIDE_PILL_MIN_W = 76
const SIDE_PILL_GAP = 12

// Font sizes (logical px): preferred -> minimum before ellipsis (spec §14).
const RANK_SIZE = { preferred: 30, min: 28 }
const NAME_SIZE = { preferred: 48, min: 36 }
const RECORD_SIZE = 32
const SIDE_LABEL_SIZE = 28
const DAY_SIZE = 30

// Row centers inside an identity block.
const ROW_TOP = 32
const ROW_NAME = 84
const ROW_RECORD = 128

function panel(scene: Phaser.Scene, rect: Rect): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(HUD_DEPTH)
  g.fillStyle(PAPER, PAPER_ALPHA)
  g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, CORNER)
  g.lineStyle(BORDER, INK, BORDER_ALPHA)
  g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, CORNER)
  return g
}

function inkText(scene: Phaser.Scene, size: number, color = INK_CSS): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, '', { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color }).setDepth(HUD_DEPTH)
}

// Sets the text with the spec's shrink-then-ellipsize rule, measured with the real text object.
function setFitted(text: Phaser.GameObjects.Text, value: string, maxWidth: number, size: { preferred: number; min: number }): void {
  const fitted = fitSingleLine(value, maxWidth, size.preferred, size.min, (candidate, fontSize) => {
    text.setFontSize(fontSize)
    text.setText(candidate)
    return text.width
  })
  text.setFontSize(fitted.fontSize)
  text.setText(fitted.text)
}

// One identity block; West mirrors East (accent band and side pill on the outer edge, text aligned to it).
function identityBlock(scene: Phaser.Scene, rect: Rect, wrestler: BoutHudWrestler, copy: BoutHudCopy): void {
  const east = wrestler.side === 'east'
  const accent = SIDE_ACCENT[wrestler.side]
  const g = panel(scene, rect)
  const bandX = east ? rect.x + BORDER : rect.x + rect.w - BORDER - ACCENT_BAND
  g.fillStyle(accent, 1)
  g.fillRect(bandX, rect.y + BORDER + CORNER, ACCENT_BAND, rect.h - 2 * (BORDER + CORNER))

  // Content edge on the outer side (left for East, right for West) and its direction inward.
  const outer = east ? rect.x + ACCENT_BAND + PADDING : rect.x + rect.w - ACCENT_BAND - PADDING
  const inward = east ? 1 : -1
  const originX = east ? 0 : 1
  const contentWidth = rect.w - ACCENT_BAND - 2 * PADDING

  // Row 1: side label pill (full word, so color is not the only cue) + rank.
  const label = inkText(scene, SIDE_LABEL_SIZE, PAPER_CSS).setText(sideLabel(copy, wrestler.side)).setOrigin(0.5)
  const pillW = Math.max(SIDE_PILL_MIN_W, Math.ceil(label.width) + 2 * SIDE_PILL_PAD_X)
  const pillX = east ? outer : outer - pillW
  g.fillStyle(accent, 1)
  g.fillRoundedRect(pillX, rect.y + ROW_TOP - SIDE_PILL_H / 2, pillW, SIDE_PILL_H, SIDE_PILL_H / 2)
  label.setPosition(pillX + pillW / 2, rect.y + ROW_TOP)
  const rank = inkText(scene, RANK_SIZE.preferred).setOrigin(originX, 0.5)
  setFitted(rank, wrestler.rankLabel, contentWidth - pillW - SIDE_PILL_GAP, RANK_SIZE)
  rank.setPosition(outer + inward * (pillW + SIDE_PILL_GAP), rect.y + ROW_TOP)

  // Row 2: name, the dominant text.
  const name = inkText(scene, NAME_SIZE.preferred).setOrigin(originX, 0.5).setFontStyle('bold')
  setFitted(name, wrestler.name, contentWidth, NAME_SIZE)
  name.setPosition(outer, rect.y + ROW_NAME)

  // Row 3: current basho record.
  inkText(scene, RECORD_SIZE)
    .setText(formatRecord(wrestler.record))
    .setOrigin(originX, 0.5)
    .setPosition(outer, rect.y + ROW_RECORD)
}

function dayChip(scene: Phaser.Scene, rect: Rect, day: number, copy: BoutHudCopy): void {
  panel(scene, rect)
  inkText(scene, DAY_SIZE)
    .setText(copy.formatDay(day))
    .setOrigin(0.5)
    .setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2)
}

// Creates the static HUD shell. The context is validated against the bout participants by the caller.
export function createBoutHud(scene: Phaser.Scene, context: BoutHudContext, copy: BoutHudCopy): void {
  identityBlock(scene, EAST_BLOCK, hudWrestlerBySide(context, 'east'), copy)
  identityBlock(scene, WEST_BLOCK, hudWrestlerBySide(context, 'west'), copy)
  dayChip(scene, DAY_CHIP, context.day, copy)
}
