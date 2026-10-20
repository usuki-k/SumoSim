import { describe, expect, it } from 'vitest'
import type { BoutOutcome } from '../sumo/BoutTypes.ts'
import { ENGLISH_BOUT_HUD_COPY, sideLabel } from './boutHudCopy.ts'
import {
  PROTOTYPE_HUD_FIXTURE,
  assertHudContextMatches,
  fitSingleLine,
  formatOutcome,
  formatRecord,
  hudWrestlerById,
  hudWrestlerBySide,
  type BoutHudContext,
} from './boutHudPresentation.ts'
import copySource from './boutHudCopy.ts?raw'
import hudSource from './boutHudPresentation.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
import typesSource from '../sumo/BoutTypes.ts?raw'
import simulationSource from '../sumo/BoutSimulation.ts?raw'

const BOUT_IDS = ['wrestler-a', 'wrestler-b']
const COPY = ENGLISH_BOUT_HUD_COPY

describe('Bout HUD presentation context (ACTION-ART-02A / 02A1)', () => {
  it('the prototype fixture has exactly two wrestlers matching the Bout participants, one per side', () => {
    expect(PROTOTYPE_HUD_FIXTURE.wrestlers).toHaveLength(2)
    expect(() => assertHudContextMatches(PROTOTYPE_HUD_FIXTURE, BOUT_IDS)).not.toThrow()
    expect(hudWrestlerBySide(PROTOTYPE_HUD_FIXTURE, 'east').participantId).toBe('wrestler-a') // left (x = -0.7)
    expect(hudWrestlerBySide(PROTOTYPE_HUD_FIXTURE, 'west').participantId).toBe('wrestler-b')
    expect(hudWrestlerById(PROTOTYPE_HUD_FIXTURE, 'wrestler-b')?.side).toBe('west')
    expect(hudWrestlerById(PROTOTYPE_HUD_FIXTURE, 'nobody')).toBeUndefined()
    // the Bout prototype setup uses the same participant ids
    for (const id of BOUT_IDS) expect(sceneSource).toContain(`id: '${id}', position:`)
  })

  it('rejects contexts that do not match the participants or the sides', () => {
    const [east, west] = PROTOTYPE_HUD_FIXTURE.wrestlers
    const bad: BoutHudContext[] = [
      { day: 1, publicParameterRows: [], wrestlers: [east, { ...west, side: 'east' }] },
      { day: 1, publicParameterRows: [], wrestlers: [east, { ...west, participantId: 'wrestler-a' }] },
      { day: 1, publicParameterRows: [], wrestlers: [east, { ...west, participantId: 'other' }] },
    ]
    for (const context of bad) expect(() => assertHudContextMatches(context, BOUT_IDS)).toThrow()
    expect(() => assertHudContextMatches(PROTOTYPE_HUD_FIXTURE, ['wrestler-a'])).toThrow()
  })

  it('English copy: side labels, day, numeric record, win and rematch results', () => {
    expect(sideLabel(COPY, 'east')).toBe('East')
    expect(sideLabel(COPY, 'west')).toBe('West')
    expect(COPY.formatDay(3)).toBe('Day 3')
    expect(COPY.formatDay(15)).toBe('Day 15')
    expect(formatRecord({ wins: 2, losses: 0 })).toBe('2-0')
    expect(formatRecord({ wins: 10, losses: 5 })).toBe('10-5')
    const westWins: BoutOutcome = { kind: 'win', winnerId: 'wrestler-b', loserId: 'wrestler-a', reason: 'ring-out' }
    const eastWins: BoutOutcome = { kind: 'win', winnerId: 'wrestler-a', loserId: 'wrestler-b', reason: 'ring-out' }
    expect(formatOutcome(westWins, PROTOTYPE_HUD_FIXTURE, COPY)).toBe('West Toshinofuji Wins')
    expect(formatOutcome(eastWins, PROTOTYPE_HUD_FIXTURE, COPY)).toBe('East Asuiryu Wins')
    expect(formatOutcome({ kind: 'rematch', reason: 'simultaneous-ring-out' }, PROTOTYPE_HUD_FIXTURE, COPY)).toBe('Rematch')
    expect(formatOutcome({ kind: 'ongoing' }, PROTOTYPE_HUD_FIXTURE, COPY)).toBe('')
  })

  it('the shipping HUD fixture and copy are English (no 02A Japanese release strings)', () => {
    const outcomes: BoutOutcome[] = [
      { kind: 'win', winnerId: 'wrestler-a', loserId: 'wrestler-b', reason: 'ring-out' },
      { kind: 'win', winnerId: 'wrestler-b', loserId: 'wrestler-a', reason: 'ring-out' },
      { kind: 'rematch', reason: 'simultaneous-ring-out' },
    ]
    const shipped = [
      COPY.east,
      COPY.west,
      COPY.rematch,
      COPY.formatDay(PROTOTYPE_HUD_FIXTURE.day),
      ...PROTOTYPE_HUD_FIXTURE.wrestlers.flatMap((w) => [w.name, w.rankLabel, formatRecord(w.record)]),
      ...outcomes.map((o) => formatOutcome(o, PROTOTYPE_HUD_FIXTURE, COPY)),
    ]
    const japanese = /[　-ヿ㐀-鿿＀-￯]/
    for (const text of shipped) expect(text, text).not.toMatch(japanese)
    for (const old of ['東', '西', '前頭十五枚目', '前頭十六枚目', '朝翠龍', '寿之富士', '日目', '勝ち', '取り直し']) {
      expect(shipped.join('|')).not.toContain(old)
    }
    expect(PROTOTYPE_HUD_FIXTURE.wrestlers.map((w) => w.rankLabel)).toEqual(['Maegashira 15', 'Maegashira 16'])
  })

  it('stays Phaser-free and keeps HUD metadata out of the Simulation', () => {
    for (const source of [hudSource, copySource]) expect(source).not.toMatch(/from ['"]phaser['"]/)
    for (const source of [typesSource, simulationSource]) expect(source).not.toMatch(/rankLabel|BoutHud|\bday\b/)
  })
})

describe('Single-line text fit (ACTION-ART-02A / 02A1)', () => {
  // Fake CJK-like measure: every code point is `fontSize` wide.
  const square = (text: string, fontSize: number) => Array.from(text).length * fontSize
  // Fake Latin measure: every code point is 0.6 * fontSize wide.
  const latin = (text: string, fontSize: number) => Array.from(text).length * fontSize * 0.6
  const NAME_WIDTH = 398 // identity block content width
  const RANK_WIDTH = 296 // content width minus the East / West pill and gap

  it('keeps the preferred size when it fits (English fixture rank and names)', () => {
    expect(fitSingleLine('Maegashira 15', RANK_WIDTH, 30, 28, latin)).toEqual({ text: 'Maegashira 15', fontSize: 30 })
    expect(fitSingleLine('Maegashira 16', RANK_WIDTH, 30, 28, latin)).toEqual({ text: 'Maegashira 16', fontSize: 30 })
    expect(fitSingleLine('Asuiryu', NAME_WIDTH, 48, 36, latin)).toEqual({ text: 'Asuiryu', fontSize: 48 })
    expect(fitSingleLine('Toshinofuji', NAME_WIDTH, 48, 36, latin)).toEqual({ text: 'Toshinofuji', fontSize: 48 })
  })

  it('shrinks to the largest size that fits, not below the minimum', () => {
    // 15 chars: 48 -> 432 (too wide), 44 -> 396 fits
    expect(fitSingleLine('Wakatakakageumi', NAME_WIDTH, 48, 36, latin)).toEqual({ text: 'Wakatakakageumi', fontSize: 44 })
    // 16 chars: 42 -> 403.2 too wide, 40 -> 384 fits
    expect(fitSingleLine('Kotoshoryunoyama', NAME_WIDTH, 48, 36, latin).fontSize).toBe(40)
    // longer rank: 17 chars, 30 -> 306 too wide, 28 -> 285.6 fits
    expect(fitSingleLine('Komusubi (Sekiwake)', RANK_WIDTH, 30, 28, latin).fontSize).toBe(28)
    expect(fitSingleLine('一二三四五六七八九', 400, 48, 36, square)).toEqual({ text: '一二三四五六七八九', fontSize: 44 })
  })

  it('ellipsizes at the minimum size when nothing fits', () => {
    const name = fitSingleLine('Kotoshoryunosukenoumi-Fujinohana', NAME_WIDTH, 48, 36, latin)
    expect(name.fontSize).toBe(36)
    expect(name.text.endsWith('…')).toBe(true)
    expect(latin(name.text, 36)).toBeLessThanOrEqual(NAME_WIDTH)
    expect(latin(name.text.slice(0, -1) + 'x…', 36)).toBeGreaterThan(NAME_WIDTH) // longest prefix kept
    const rank = fitSingleLine('Maegashira 15 East (Makuuchi Division)', RANK_WIDTH, 30, 28, latin)
    expect(rank.fontSize).toBe(28)
    expect(rank.text).toBe('Maegashira 15 Ea…') // 17 code points * 16.8 = 285.6 <= 296; 18 would be 302.4
  })

  it('never splits surrogate pairs and degrades to the ellipsis alone', () => {
    expect(fitSingleLine('𠮷𠮷𠮷𠮷𠮷', 3 * 36, 48, 36, square).text).toBe('𠮷𠮷…')
    expect(fitSingleLine('Toshinofuji', 10, 48, 36, latin).text).toBe('…')
  })
})
