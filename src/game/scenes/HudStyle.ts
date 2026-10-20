// Shared Product UI style for the Bout HUD and the pre-bout comparison (ACTION-ART-02A / 02A1 / 02B,
// docs/ACTION_HUD_PRODUCT_SPEC.md §6). Presentation only. Values are Provisional for User Visual Check.
import Phaser from 'phaser'
import { sideLabel, type BoutHudCopy } from '../presentation/boutHudCopy.ts'
import { fitSingleLine, type BoutSide } from '../presentation/boutHudPresentation.ts'

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

// Paper panel, ink text, subdued side accents.
export const PAPER = 0xf2e8d5
export const PAPER_ALPHA = 0.93
export const INK = 0x1f1a16
export const INK_CSS = '#1f1a16'
export const PAPER_CSS = '#f6eedf'
export const BORDER_ALPHA = 0.85
export const SIDE_ACCENT: Record<BoutSide, number> = { east: 0x34507a, west: 0xa3452f }

// Latin system serif stack (no font asset); provisional until Product typography work.
export const FONT_FAMILY = 'Georgia, "Times New Roman", Times, serif'
export const CORNER = 6
export const BORDER = 2

// Side label pill: sized to the measured full word (East / West), at least SIDE_PILL_MIN_W wide.
const SIDE_PILL_H = 36
const SIDE_PILL_PAD_X = 12
const SIDE_PILL_MIN_W = 76
const SIDE_LABEL_SIZE = 28

export interface FitSize {
  readonly preferred: number
  readonly min: number
}

// Paper panel with an ink border, drawn into `g`.
export function paperPanel(g: Phaser.GameObjects.Graphics, rect: Rect): void {
  g.fillStyle(PAPER, PAPER_ALPHA)
  g.fillRoundedRect(rect.x, rect.y, rect.w, rect.h, CORNER)
  g.lineStyle(BORDER, INK, BORDER_ALPHA)
  g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, CORNER)
}

// A text object in the Product typography, added to `layer` (creation order = draw order).
export function inkText(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, size: number, color = INK_CSS): Phaser.GameObjects.Text {
  const text = scene.add.text(0, 0, '', { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color })
  layer.add(text)
  return text
}

// Sets the text with the spec's shrink-then-ellipsize rule, measured with the real text object.
export function setFitted(text: Phaser.GameObjects.Text, value: string, maxWidth: number, size: FitSize): void {
  const fitted = fitSingleLine(value, maxWidth, size.preferred, size.min, (candidate, fontSize) => {
    text.setFontSize(fontSize)
    text.setText(candidate)
    return text.width
  })
  text.setFontSize(fitted.fontSize)
  text.setText(fitted.text)
}

// Draws the side pill (accent fill into `g`, word as text) with its left edge at `x` ('left'), right edge
// at `x` ('right') or centered on `x` ('center'). Returns the pill width.
export function sidePill(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  copy: BoutHudCopy,
  side: BoutSide,
  x: number,
  centerY: number,
  anchor: 'left' | 'right' | 'center',
): number {
  const label = inkText(scene, layer, SIDE_LABEL_SIZE, PAPER_CSS).setText(sideLabel(copy, side)).setOrigin(0.5)
  const pillW = Math.max(SIDE_PILL_MIN_W, Math.ceil(label.width) + 2 * SIDE_PILL_PAD_X)
  const pillX = anchor === 'left' ? x : anchor === 'right' ? x - pillW : x - pillW / 2
  g.fillStyle(SIDE_ACCENT[side], 1)
  g.fillRoundedRect(pillX, centerY - SIDE_PILL_H / 2, pillW, SIDE_PILL_H, SIDE_PILL_H / 2)
  label.setPosition(pillX + pillW / 2, centerY)
  return pillW
}
