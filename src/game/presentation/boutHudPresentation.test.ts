import { describe, expect, it } from 'vitest'
import type { BoutOutcome } from '../sumo/BoutTypes.ts'
import {
  PROTOTYPE_HUD_FIXTURE,
  assertHudContextMatches,
  fitSingleLine,
  formatDay,
  formatOutcome,
  formatRecord,
  formatSide,
  hudWrestlerById,
  hudWrestlerBySide,
  type BoutHudContext,
} from './boutHudPresentation.ts'
import hudSource from './boutHudPresentation.ts?raw'
import sceneSource from '../scenes/BoutScene.ts?raw'
import typesSource from '../sumo/BoutTypes.ts?raw'

const BOUT_IDS = ['wrestler-a', 'wrestler-b']

describe('Bout HUD presentation context (ACTION-ART-02A)', () => {
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
      { day: 1, wrestlers: [east, { ...west, side: 'east' }] },
      { day: 1, wrestlers: [east, { ...west, participantId: 'wrestler-a' }] },
      { day: 1, wrestlers: [east, { ...west, participantId: 'other' }] },
    ]
    for (const context of bad) expect(() => assertHudContextMatches(context, BOUT_IDS)).toThrow()
    expect(() => assertHudContextMatches(PROTOTYPE_HUD_FIXTURE, ['wrestler-a'])).toThrow()
  })

  it('formats side, record, day and the result text', () => {
    expect(formatSide('east')).toBe('東')
    expect(formatSide('west')).toBe('西')
    expect(formatRecord({ wins: 2, losses: 0 })).toBe('2-0')
    expect(formatRecord({ wins: 10, losses: 5 })).toBe('10-5')
    expect(formatDay(3)).toBe('3日目')
    expect(formatDay(15)).toBe('15日目')
    const win: BoutOutcome = { kind: 'win', winnerId: 'wrestler-b', loserId: 'wrestler-a', reason: 'ring-out' }
    expect(formatOutcome(win, PROTOTYPE_HUD_FIXTURE)).toBe('西 寿之富士 勝ち')
    expect(formatOutcome({ kind: 'rematch', reason: 'simultaneous-ring-out' }, PROTOTYPE_HUD_FIXTURE)).toBe('同体 取り直し')
    expect(formatOutcome({ kind: 'ongoing' }, PROTOTYPE_HUD_FIXTURE)).toBe('')
  })

  it('stays Phaser-free and keeps HUD metadata out of the Simulation types', () => {
    expect(hudSource).not.toMatch(/from ['"]phaser['"]/)
    expect(typesSource).not.toMatch(/rankLabel|record|\bday\b/)
  })
})

describe('Single-line text fit (ACTION-ART-02A)', () => {
  // Fake measure: every code point is `fontSize` wide.
  const measure = (text: string, fontSize: number) => Array.from(text).length * fontSize

  it('keeps the preferred size when it fits', () => {
    expect(fitSingleLine('朝翠龍', 400, 48, 36, measure)).toEqual({ text: '朝翠龍', fontSize: 48 })
  })

  it('shrinks to the largest size that fits, not below the minimum', () => {
    // 9 chars: 48 -> 432 (too wide), 44 -> 396 fits
    expect(fitSingleLine('一二三四五六七八九', 400, 48, 36, measure)).toEqual({ text: '一二三四五六七八九', fontSize: 44 })
    // 11 chars: only 36 fits (396)
    expect(fitSingleLine('一二三四五六七八九十一', 400, 48, 36, measure)).toEqual({ text: '一二三四五六七八九十一', fontSize: 36 })
  })

  it('ellipsizes at the minimum size when nothing fits', () => {
    const fitted = fitSingleLine('一二三四五六七八九十一二三四五', 400, 48, 36, measure)
    expect(fitted.fontSize).toBe(36)
    expect(fitted.text).toBe('一二三四五六七八九十…') // 11 code points * 36 = 396
    expect(measure(fitted.text, 36)).toBeLessThanOrEqual(400)
  })

  it('never splits surrogate pairs and degrades to the ellipsis alone', () => {
    const fitted = fitSingleLine('𠮷𠮷𠮷𠮷𠮷', 3 * 36, 48, 36, measure)
    expect(fitted.text).toBe('𠮷𠮷…')
    expect(fitSingleLine('長い名前', 10, 48, 36, measure).text).toBe('…')
  })
})
