import { describe, expect, it } from 'vitest'
import { BODY_RADIUS } from '../sumo/BoutSimulation.ts'
import type { ArenaSetup } from '../sumo/BoutTypes.ts'
import {
  PRODUCT_ART_CENTER,
  PRODUCT_ART_HEIGHT,
  PRODUCT_ART_WIDTH,
  PRODUCT_RING_RADIUS_PX,
  PRODUCT_TOKUDAWARA_DEPTH_PX,
  PRODUCT_TOKUDAWARA_HALF_ANGLE,
  productPixelsPerMeter,
} from './productArena.ts'
import productArenaSource from './productArena.ts?raw'

// Accepted Simulation geometry (TOKUDAWARA-01A) used by the Bout prototype.
const ARENA: ArenaSetup = { radius: 2.275, tokudawara: { depth: 0.1194375, halfAngle: Math.PI / 20 } }

describe('Product arena art contract (ACTION-ART-01B)', () => {
  it('logical canvas is the 16:9 runtime art space with the ring at its center', () => {
    expect([PRODUCT_ART_WIDTH, PRODUCT_ART_HEIGHT]).toEqual([1920, 1080])
    expect(PRODUCT_ART_WIDTH / PRODUCT_ART_HEIGHT).toBeCloseTo(16 / 9, 12)
    expect(PRODUCT_ART_CENTER).toEqual({ x: 960, y: 540 })
    expect(PRODUCT_RING_RADIUS_PX).toBe(400)
  })

  it('Simulation meters map exactly onto the Candidate C art geometry', () => {
    const ppm = productPixelsPerMeter(ARENA)
    expect(ppm).toBe(400 / 2.275)
    expect(ARENA.radius * ppm).toBeCloseTo(PRODUCT_RING_RADIUS_PX, 12)
    expect(ARENA.tokudawara!.depth * ppm).toBeCloseTo(PRODUCT_TOKUDAWARA_DEPTH_PX, 12)
    expect(ARENA.tokudawara!.halfAngle).toBe(PRODUCT_TOKUDAWARA_HALF_ANGLE)
    // same ratio as the art master (42 / 800)
    expect(PRODUCT_TOKUDAWARA_DEPTH_PX / PRODUCT_RING_RADIUS_PX).toBe(42 / 800)
    // current provisional wrestler diameter at Product scale (~123 px)
    expect(2 * BODY_RADIUS * ppm).toBeCloseTo(123.08, 2)
  })

  it('stays Phaser-free', () => {
    expect(productArenaSource).not.toMatch(/from ['"]phaser['"]/)
  })
})
