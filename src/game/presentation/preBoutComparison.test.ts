import { describe, expect, it } from 'vitest'
import { ENGLISH_BOUT_HUD_COPY } from './boutHudCopy.ts'
import {
  PROTOTYPE_HUD_FIXTURE,
  buildComparisonRows,
  comparisonRowPitch,
  hudWrestlerBySide,
  type BoutHudContext,
  type PublicParameterComparisonRow,
} from './boutHudPresentation.ts'
import typesSource from '../sumo/BoutTypes.ts?raw'
import simulationSource from '../sumo/BoutSimulation.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
import comparisonViewSource from '../scenes/PreBoutComparisonView.ts?raw'

const COPY = ENGLISH_BOUT_HUD_COPY

const syntheticRows = (n: number): PublicParameterComparisonRow[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `synthetic-${i}`,
    label: `Synthetic Row ${i}`,
    values: { east: `${10 + i}`, west: `${90 - i}` },
  }))

const withRows = (rows: PublicParameterComparisonRow[]): BoutHudContext => ({ ...PROTOTYPE_HUD_FIXTURE, publicParameterRows: rows })

describe('Pre-bout comparison presentation (ACTION-ART-02B)', () => {
  it('fixture profile values exist for both sides (presentation only)', () => {
    const east = hudWrestlerBySide(PROTOTYPE_HUD_FIXTURE, 'east')
    const west = hudWrestlerBySide(PROTOTYPE_HUD_FIXTURE, 'west')
    expect([east.ageYears, east.heightCm, east.weightKg]).toEqual([26, 175, 120])
    expect([west.ageYears, west.heightCm, west.weightKg]).toEqual([29, 183, 148])
  })

  it('fixture public parameter rows are placeholders with unique keys and East / West values', () => {
    const rows = PROTOTYPE_HUD_FIXTURE.publicParameterRows
    expect(rows.length).toBeGreaterThanOrEqual(6)
    expect(rows.length).toBeLessThanOrEqual(8)
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
    for (const row of rows) {
      expect(row.label).toMatch(/^Sample Stat [A-Z]$/) // unmistakably not final parameter names
      expect(row.values.east).not.toBe('')
      expect(row.values.west).not.toBe('')
    }
  })

  it('English comparison copy and formatting', () => {
    expect([COPY.age, COPY.height, COPY.weight]).toEqual(['Age', 'Height', 'Weight'])
    expect(COPY.formatAge(26)).toBe('26 yrs')
    expect(COPY.formatHeight(175)).toBe('175 cm')
    expect(COPY.formatWeight(120)).toBe('120 kg')
    expect(COPY.startPrompt).toBe('Press Enter to Start')
  })

  it('rows are age / height / weight, then every public parameter row in order', () => {
    const rows = buildComparisonRows(PROTOTYPE_HUD_FIXTURE, COPY)
    expect(rows.slice(0, 3)).toEqual([
      { key: 'age', label: 'Age', east: '26 yrs', west: '29 yrs' },
      { key: 'height', label: 'Height', east: '175 cm', west: '183 cm' },
      { key: 'weight', label: 'Weight', east: '120 kg', west: '148 kg' },
    ])
    expect(rows.slice(3)).toEqual(
      PROTOTYPE_HUD_FIXTURE.publicParameterRows.map((r) => ({ key: r.key, label: r.label, east: r.values.east, west: r.values.west })),
    )
  })

  it('variable row counts: 0, 1, fixture and 12 rows are all kept, in order, without omission', () => {
    for (const n of [0, 1, PROTOTYPE_HUD_FIXTURE.publicParameterRows.length, 12]) {
      const source = n === PROTOTYPE_HUD_FIXTURE.publicParameterRows.length ? [...PROTOTYPE_HUD_FIXTURE.publicParameterRows] : syntheticRows(n)
      const rows = buildComparisonRows(withRows(source), COPY)
      expect(rows).toHaveLength(3 + n)
      expect(rows.slice(3).map((r) => r.key)).toEqual(source.map((r) => r.key))
      expect(rows.slice(3).map((r) => [r.label, r.east, r.west])).toEqual(source.map((r) => [r.label, r.values.east, r.values.west]))
    }
  })

  it('row pitch: preferred when the rows fit, compressed to the minimum otherwise, never dropping rows', () => {
    const available = 492 // current table height
    expect(comparisonRowPitch(3, available, 48, 32)).toBe(48) // 0 parameter rows
    expect(comparisonRowPitch(10, available, 48, 32)).toBe(48) // fixture (3 + 7)
    expect(comparisonRowPitch(15, available, 48, 32)).toBeCloseTo(32.8, 9) // 3 + 12, compressed
    expect(comparisonRowPitch(40, available, 48, 32)).toBe(32) // beyond: minimum (overflow behavior Deferred)
    expect(comparisonRowPitch(0, available, 48, 32)).toBe(48)
  })

  it('the shipping comparison copy and fixture are English', () => {
    const shipped = [
      COPY.age,
      COPY.height,
      COPY.weight,
      COPY.startPrompt,
      ...buildComparisonRows(PROTOTYPE_HUD_FIXTURE, COPY).flatMap((r) => [r.label, r.east, r.west]),
    ]
    for (const text of shipped) expect(text, text).not.toMatch(/[　-ヿ㐀-鿿＀-￯]/)
  })

  it('profile and public parameters stay out of the Simulation; the view renders every row', () => {
    for (const source of [typesSource, simulationSource]) {
      expect(source).not.toMatch(/ageYears|heightCm|weightKg|publicParameter|BoutHud|Comparison/)
    }
    // The comparison view iterates the supplied rows (no fixed count) and the Scene gates stepping.
    expect(comparisonViewSource).toMatch(/rows\.forEach/)
    expect(sceneSource).toMatch(/if \(this\.phase === 'pre-bout'\) \{[\s\S]*?return\s*\}/)
  })
})
