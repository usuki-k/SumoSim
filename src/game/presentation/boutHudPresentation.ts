// Bout HUD presentation context (ACTION-ART-02A, docs/ACTION_HUD_PRODUCT_SPEC.md). Pure TypeScript;
// must not import Phaser. Wrestler / tournament display data lives here, outside BoutSimulation /
// ParticipantState / BoutSnapshot; the only join key with the Simulation is the participant id.
// Content strings here (name, rank label) are already locale-resolved display text; fixed UI copy comes
// from boutHudCopy.ts.
import type { BoutOutcome, ParticipantId } from '../sumo/BoutTypes.ts'
import type { BoutHudCopy } from './boutHudCopy.ts'

export type BoutSide = 'east' | 'west'

export interface BoutHudWrestler {
  readonly participantId: ParticipantId
  readonly side: BoutSide
  // Display name (romanized for the English release).
  readonly name: string
  // Rank display text; there is no rank system yet, so the label is taken as is.
  readonly rankLabel: string
  // Current basho record.
  readonly record: { readonly wins: number; readonly losses: number }
}

export interface BoutHudContext {
  // Day of the current basho.
  readonly day: number
  readonly wrestlers: readonly [BoutHudWrestler, BoutHudWrestler]
}

// PROTOTYPE FIXTURE: sample English presentation data for the HUD shell, not game content. Names,
// ranks, records and the day are placeholders until Management / Tournament state exists; the names are
// sample romanized display names (no shikona generation or romanization rules).
export const PROTOTYPE_HUD_FIXTURE: BoutHudContext = {
  day: 3,
  wrestlers: [
    { participantId: 'wrestler-a', side: 'east', name: 'Asuiryu', rankLabel: 'Maegashira 15', record: { wins: 2, losses: 0 } },
    { participantId: 'wrestler-b', side: 'west', name: 'Toshinofuji', rankLabel: 'Maegashira 16', record: { wins: 1, losses: 1 } },
  ],
}

// Throws unless the context describes exactly the given participants, one East and one West.
export function assertHudContextMatches(context: BoutHudContext, participantIds: readonly ParticipantId[]): void {
  const ids = context.wrestlers.map((w) => w.participantId)
  const sides = context.wrestlers.map((w) => w.side).sort()
  if (sides[0] !== 'east' || sides[1] !== 'west') throw new Error('Invalid BoutHudContext: needs one east and one west wrestler')
  if (ids[0] === ids[1] || participantIds.length !== 2 || !participantIds.every((id) => ids.includes(id))) {
    throw new Error('Invalid BoutHudContext: wrestlers must match the bout participants')
  }
}

export function hudWrestlerBySide(context: BoutHudContext, side: BoutSide): BoutHudWrestler {
  // assertHudContextMatches guarantees exactly one per side.
  return context.wrestlers.find((w) => w.side === side) ?? context.wrestlers[0]
}

export function hudWrestlerById(context: BoutHudContext, id: ParticipantId): BoutHudWrestler | undefined {
  return context.wrestlers.find((w) => w.participantId === id)
}

// Numeric current-basho record (wins-losses); language-neutral.
export function formatRecord(record: BoutHudWrestler['record']): string {
  return `${record.wins}-${record.losses}`
}

// Result text from the Simulation outcome (ids only) + the HUD context + UI copy. Not a final result
// screen.
export function formatOutcome(outcome: BoutOutcome, context: BoutHudContext, copy: BoutHudCopy): string {
  if (outcome.kind === 'ongoing') return ''
  if (outcome.kind === 'rematch') return copy.rematch
  const winner = hudWrestlerById(context, outcome.winnerId)
  return winner ? copy.formatWin(winner.side, winner.name) : outcome.winnerId
}

export interface FittedText {
  readonly text: string
  readonly fontSize: number
}

const ELLIPSIS = '…'

// Single-line fit: the preferred font size if it fits, otherwise the largest size down to `minSize`
// (in `step` px) that fits, otherwise `minSize` with the text ellipsized. `measure` returns the
// rendered width of `text` at `fontSize` (supplied by the view, so this stays testable).
export function fitSingleLine(
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize: number,
  measure: (text: string, fontSize: number) => number,
  step = 2,
): FittedText {
  for (let size = preferredSize; size >= minSize; size -= step) {
    if (measure(text, size) <= maxWidth) return { text, fontSize: size }
  }
  if (measure(text, minSize) <= maxWidth) return { text, fontSize: minSize }
  const chars = Array.from(text) // code points, so surrogate pairs are never split
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(chars.slice(0, mid).join('') + ELLIPSIS, minSize) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return { text: chars.slice(0, lo).join('') + ELLIPSIS, fontSize: minSize }
}
