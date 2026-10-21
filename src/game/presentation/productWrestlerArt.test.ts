import { describe, expect, it } from 'vitest'
import { BODY_RADIUS } from '../sumo/BoutSimulation.ts'
import { productPixelsPerMeter } from './productArena.ts'
import { PRODUCT_WRESTLER_ART, productWrestlerOrigin, productWrestlerScale } from './productWrestlerArt.ts'
import productWrestlerArtSource from './productWrestlerArt.ts?raw'

// The committed PNG sizes / pivots / body cores are checked against a fresh export by the wrestler-art
// Python tests (tools/wrestler_art/tests/test_export_runtime_wrestlers.py).
const ARTS = Object.values(PRODUCT_WRESTLER_ART)

describe('Product wrestler art contract (ACTION-ART-03A)', () => {
  it('blue and red are separate assets with distinct keys and files', () => {
    expect(ARTS.map((art) => art.id)).toEqual(['blue', 'red'])
    expect(new Set(ARTS.map((art) => art.textureKey)).size).toBe(2)
    expect(new Set(ARTS.map((art) => art.assetPath)).size).toBe(2)
    for (const art of ARTS) expect(art.assetPath).toBe(`assets/action/wrestler/${art.id}.png`)
  })

  it('keeps the pivot inside the texture', () => {
    for (const art of ARTS) {
      expect(art.pivot.x).toBeGreaterThan(0)
      expect(art.pivot.x).toBeLessThan(art.width)
      expect(art.pivot.y).toBeGreaterThan(0)
      expect(art.pivot.y).toBeLessThan(art.height)
    }
  })

  it('pivot -> Phaser origin puts the pivot on the image position', () => {
    const blue = productWrestlerOrigin(PRODUCT_WRESTLER_ART.blue)
    expect(blue.x).toBeCloseTo(82 / 158, 12)
    expect(blue.y).toBeCloseTo(83 / 178, 12)
    for (const art of ARTS) {
      const origin = productWrestlerOrigin(art)
      expect(origin.x * art.width).toBeCloseTo(art.pivot.x, 9)
      expect(origin.y * art.height).toBeCloseTo(art.pivot.y, 9)
    }
  })

  it('body-core scale is ~1.0 at the accepted bodyRadius and follows bodyRadiusPx linearly', () => {
    const bodyRadiusPx = BODY_RADIUS * productPixelsPerMeter({ radius: 2.275 })
    for (const art of ARTS) {
      expect(art.bodyCoreDiameterPx).toBeCloseTo(2 * bodyRadiusPx, 4)
      expect(productWrestlerScale(art, bodyRadiusPx)).toBeCloseTo(1, 6)
      expect(productWrestlerScale(art, bodyRadiusPx * 1.2)).toBeCloseTo(1.2, 6)
      expect(productWrestlerScale(art, 50)).toBe(100 / art.bodyCoreDiameterPx)
    }
  })

  it('ART-WRESTLER-04B: blue is the red master reflected across local X (same size, pivot y -> H - y)', () => {
    const { blue, red } = PRODUCT_WRESTLER_ART
    expect([blue.width, blue.height]).toEqual([red.width, red.height])
    expect(blue.pivot).toEqual({ x: red.pivot.x, y: red.height - red.pivot.y })
    expect(blue.bodyCoreDiameterPx).toBe(red.bodyCoreDiameterPx)
  })

  it('stays Phaser-free', () => {
    expect(productWrestlerArtSource).not.toMatch(/from ['"]phaser['"]/)
  })
})
