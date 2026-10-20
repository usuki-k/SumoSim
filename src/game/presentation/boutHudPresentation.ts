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
  // Pre-bout comparison profile (ACTION-ART-02B). Presentation values only: not physics state, and not
  // connected to bodyRadius, Push or any gameplay.
  readonly ageYears: number
  readonly heightCm: number
  readonly weightKg: number
}

// One public-parameter row of the pre-bout comparison, already locale-resolved for display. The final
// parameter model is unresolved; this is only what the comparison layout needs (no enums, ranges or
// formulas).
export interface PublicParameterComparisonRow {
  readonly key: string
  readonly label: string
  readonly values: Readonly<Record<BoutSide, string>>
  readonly group?: string
}

export interface BoutHudContext {
  // Day of the current basho.
  readonly day: number
  readonly wrestlers: readonly [BoutHudWrestler, BoutHudWrestler]
  // Every row is shown in the pre-bout comparison, in order (no count limit, no omission).
  readonly publicParameterRows: readonly PublicParameterComparisonRow[]
}

// PROTOTYPE FIXTURE: sample English presentation data for the HUD shell, not game content. Names,
// ranks, records, the day and the age / height / weight profile are placeholders until Management /
// Tournament state exists; the names are sample romanized display names (no shikona generation or
// romanization rules).
export const PROTOTYPE_HUD_FIXTURE: BoutHudContext = {
  day: 3,
  wrestlers: [
    {
      participantId: 'wrestler-a',
      side: 'east',
      name: 'Asuiryu',
      rankLabel: 'Maegashira 15',
      record: { wins: 2, losses: 0 },
      ageYears: 26,
      heightCm: 175,
      weightKg: 120,
    },
    {
      participantId: 'wrestler-b',
      side: 'west',
      name: 'Toshinofuji',
      rankLabel: 'Maegashira 16',
      record: { wins: 1, losses: 1 },
      ageYears: 29,
      heightCm: 183,
      weightKg: 148,
    },
  ],
  // Prototype comparison-layout data; not final game parameters. Deliberately generic labels so they are
  // not mistaken for a parameter design (the final public parameter list is unresolved).
  publicParameterRows: [
    { key: 'sample-stat-a', label: 'Sample Stat A', values: { east: '72', west: '64' } },
    { key: 'sample-stat-b', label: 'Sample Stat B', values: { east: '58', west: '70' } },
    { key: 'sample-stat-c', label: 'Sample Stat C', values: { east: '81', west: '77' } },
    { key: 'sample-stat-d', label: 'Sample Stat D', values: { east: '45', west: '52' } },
    { key: 'sample-stat-e', label: 'Sample Stat E', values: { east: '66', west: '61' } },
    { key: 'sample-stat-f', label: 'Sample Stat F', values: { east: '74', west: '69' } },
    { key: 'sample-stat-g', label: 'Sample Stat G', values: { east: '60', west: '83' } },
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

// One row of the pre-bout comparison table: `east value | label | west value`.
export interface ComparisonRow {
  readonly key: string
  readonly label: string
  readonly east: string
  readonly west: string
}

// Profile rows (age, height, weight) followed by every supplied public-parameter row, in order.
export function buildComparisonRows(context: BoutHudContext, copy: BoutHudCopy): ComparisonRow[] {
  const east = hudWrestlerBySide(context, 'east')
  const west = hudWrestlerBySide(context, 'west')
  return [
    { key: 'age', label: copy.age, east: copy.formatAge(east.ageYears), west: copy.formatAge(west.ageYears) },
    { key: 'height', label: copy.height, east: copy.formatHeight(east.heightCm), west: copy.formatHeight(west.heightCm) },
    { key: 'weight', label: copy.weight, east: copy.formatWeight(east.weightKg), west: copy.formatWeight(west.weightKg) },
    ...context.publicParameterRows.map((row) => ({ key: row.key, label: row.label, east: row.values.east, west: row.values.west })),
  ]
}

// Row pitch for `count` rows in `available` px: `preferred` when they fit, otherwise compressed down to
// `min`. Rows are never dropped; below `min` they simply extend further (paging / scroll are Deferred).
export function comparisonRowPitch(count: number, available: number, preferred: number, min: number): number {
  if (count <= 0) return preferred
  return Math.max(min, Math.min(preferred, available / count))
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
