// Pre-bout comparison screen (ACTION-ART-02B, docs/ACTION_HUD_PRODUCT_SPEC.md §4 / §8). Presentation only:
// a dimmer over the Product arena and one paper panel comparing East / West (identity header, then
// `east value | label | west value` rows for age / height / weight and every supplied public-parameter
// row) with the prototype start prompt. Reads no Simulation state. Layout values are Provisional.
import Phaser from 'phaser'
import type { BoutHudCopy } from '../presentation/boutHudCopy.ts'
import {
  buildComparisonRows,
  comparisonRowPitch,
  formatRecord,
  hudWrestlerBySide,
  type BoutHudContext,
  type BoutHudWrestler,
} from '../presentation/boutHudPresentation.ts'
import { PRODUCT_ART_HEIGHT, PRODUCT_ART_WIDTH } from '../presentation/productArena.ts'
import { INK, PAPER_CSS, SIDE_ACCENT, inkText, paperPanel, setFitted, sidePill, type Rect } from './HudStyle.ts'

// Above the Product arena, wrestlers, debug overlays (3) and the Action HUD (4).
export const COMPARISON_DEPTH = 10

const DIMMER_ALPHA = 0.55
const PANEL: Rect = { x: 240, y: 70, w: 1440, h: 940 }
const CENTER_X = PANEL.x + PANEL.w / 2
// Header columns (East left, West right), centered in each half.
const COLUMN_W = 560
const EAST_CENTER_X = PANEL.x + PANEL.w / 4
const WEST_CENTER_X = PANEL.x + (PANEL.w * 3) / 4

// Header rows (offsets from the panel top).
const ROW_DAY = 46
const ROW_SIDE = 108
const ROW_RANK = 156
const ROW_NAME = 214
const ROW_RECORD = 272
const ACCENT_RULE_Y = 312
const ACCENT_RULE_H = 6

// Comparison table: values aligned toward the center label column.
const TABLE_TOP = 336
const TABLE_BOTTOM = PANEL.h - 112
const LABEL_W = 380
const VALUE_GAP = 30 // between a value and the label column
const VALUE_EDGE = PANEL.x + 48 // outer limit of the East values (mirrored for West)
const ROW_PITCH = { preferred: 48, min: 32 }
const PROFILE_ROWS = 3 // age, height, weight; a stronger rule follows them

// Fonts (logical px): preferred -> minimum before ellipsis.
const DAY_SIZE = 32
const RANK_SIZE = { preferred: 32, min: 28 }
const NAME_SIZE = { preferred: 60, min: 40 }
const RECORD_SIZE = 34
const LABEL_SIZE = { preferred: 30, min: 28 }
const VALUE_SIZE = { preferred: 34, min: 28 }
const PROMPT_SIZE = 34
const PROMPT_Y = PANEL.h - 56
const PROMPT_PAD = { x: 28, h: 56 }

function header(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, g: Phaser.GameObjects.Graphics, wrestler: BoutHudWrestler, centerX: number, copy: BoutHudCopy): void {
  sidePill(scene, layer, g, copy, wrestler.side, centerX, PANEL.y + ROW_SIDE, 'center')
  const rank = inkText(scene, layer, RANK_SIZE.preferred).setOrigin(0.5)
  setFitted(rank, wrestler.rankLabel, COLUMN_W, RANK_SIZE)
  rank.setPosition(centerX, PANEL.y + ROW_RANK)
  const name = inkText(scene, layer, NAME_SIZE.preferred).setOrigin(0.5).setFontStyle('bold')
  setFitted(name, wrestler.name, COLUMN_W, NAME_SIZE)
  name.setPosition(centerX, PANEL.y + ROW_NAME)
  inkText(scene, layer, RECORD_SIZE)
    .setText(formatRecord(wrestler.record))
    .setOrigin(0.5)
    .setPosition(centerX, PANEL.y + ROW_RECORD)
  g.fillStyle(SIDE_ACCENT[wrestler.side], 1)
  g.fillRect(centerX - COLUMN_W / 2, PANEL.y + ACCENT_RULE_Y, COLUMN_W, ACCENT_RULE_H)
}

// Creates the comparison screen as one layer (toggle with setVisible).
export function createPreBoutComparison(scene: Phaser.Scene, context: BoutHudContext, copy: BoutHudCopy): Phaser.GameObjects.Container {
  const layer = scene.add.container(0, 0).setDepth(COMPARISON_DEPTH)
  // Dimmer: the arena stays recognizable underneath (no blur / post-processing).
  layer.add(scene.add.rectangle(0, 0, PRODUCT_ART_WIDTH, PRODUCT_ART_HEIGHT, 0x000000, DIMMER_ALPHA).setOrigin(0))

  const g = scene.add.graphics()
  layer.add(g)
  paperPanel(g, PANEL)

  inkText(scene, layer, DAY_SIZE)
    .setText(copy.formatDay(context.day))
    .setOrigin(0.5)
    .setPosition(CENTER_X, PANEL.y + ROW_DAY)
  header(scene, layer, g, hudWrestlerBySide(context, 'east'), EAST_CENTER_X, copy)
  header(scene, layer, g, hudWrestlerBySide(context, 'west'), WEST_CENTER_X, copy)

  // Every row, in order; the pitch compresses for long lists but no row is ever dropped.
  const rows = buildComparisonRows(context, copy)
  const pitch = comparisonRowPitch(rows.length, TABLE_BOTTOM - TABLE_TOP, ROW_PITCH.preferred, ROW_PITCH.min)
  const valueWidth = CENTER_X - LABEL_W / 2 - VALUE_GAP - VALUE_EDGE
  const ruleX0 = VALUE_EDGE
  const ruleX1 = PANEL.x + PANEL.w - (VALUE_EDGE - PANEL.x)
  rows.forEach((row, i) => {
    const y = PANEL.y + TABLE_TOP + pitch * (i + 0.5)
    const label = inkText(scene, layer, LABEL_SIZE.preferred).setOrigin(0.5)
    setFitted(label, row.label, LABEL_W, LABEL_SIZE)
    label.setPosition(CENTER_X, y)
    const east = inkText(scene, layer, VALUE_SIZE.preferred).setOrigin(1, 0.5)
    setFitted(east, row.east, valueWidth, VALUE_SIZE)
    east.setPosition(CENTER_X - LABEL_W / 2 - VALUE_GAP, y)
    const west = inkText(scene, layer, VALUE_SIZE.preferred).setOrigin(0, 0.5)
    setFitted(west, row.west, valueWidth, VALUE_SIZE)
    west.setPosition(CENTER_X + LABEL_W / 2 + VALUE_GAP, y)
    // Row rule; a stronger one separates the profile rows from the public parameters.
    const strong = i === PROFILE_ROWS - 1 && rows.length > PROFILE_ROWS
    g.lineStyle(strong ? 2 : 1, INK, strong ? 0.45 : 0.15)
    g.lineBetween(ruleX0, y + pitch / 2, ruleX1, y + pitch / 2)
  })

  // Prototype start prompt (Enter), from the copy boundary.
  const prompt = inkText(scene, layer, PROMPT_SIZE, PAPER_CSS).setText(copy.startPrompt).setOrigin(0.5)
  const promptW = Math.ceil(prompt.width) + 2 * PROMPT_PAD.x
  g.fillStyle(INK, 0.9)
  g.fillRoundedRect(CENTER_X - promptW / 2, PANEL.y + PROMPT_Y - PROMPT_PAD.h / 2, promptW, PROMPT_PAD.h, PROMPT_PAD.h / 2)
  prompt.setPosition(CENTER_X, PANEL.y + PROMPT_Y)
  return layer
}
