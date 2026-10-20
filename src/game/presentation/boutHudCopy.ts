// Fixed Bout HUD UI copy (ACTION-ART-02A1). Pure TypeScript; must not import Phaser.
// The initial release ships English only. Every fixed HUD label / phrase lives behind this one small
// interface so another language could supply its own copy later without touching the HUD view or
// gameplay. Not a localization framework: no catalogs, locale detection or selector.
import type { BoutSide } from './boutHudPresentation.ts'

export interface BoutHudCopy {
  readonly east: string
  readonly west: string
  readonly rematch: string
  formatDay(day: number): string
  formatWin(side: BoutSide, wrestlerName: string): string
}

const ENGLISH_EAST = 'East'
const ENGLISH_WEST = 'West'

export const ENGLISH_BOUT_HUD_COPY: BoutHudCopy = {
  east: ENGLISH_EAST,
  west: ENGLISH_WEST,
  rematch: 'Rematch',
  formatDay: (day) => `Day ${day}`,
  formatWin: (side, wrestlerName) => `${side === 'east' ? ENGLISH_EAST : ENGLISH_WEST} ${wrestlerName} Wins`,
}

export function sideLabel(copy: BoutHudCopy, side: BoutSide): string {
  return side === 'east' ? copy.east : copy.west
}
