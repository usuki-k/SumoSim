import { describe, expect, it } from 'vitest'
import { movementVectorFromKeys } from './movementVector.ts'

const NONE = { up: false, down: false, left: false, right: false }

describe('movementVectorFromKeys', () => {
  it('T11: maps W/S/A/D to screen-relative axes', () => {
    expect(movementVectorFromKeys({ ...NONE, up: true })).toEqual({ x: 0, y: -1 })
    expect(movementVectorFromKeys({ ...NONE, down: true })).toEqual({ x: 0, y: 1 })
    expect(movementVectorFromKeys({ ...NONE, left: true })).toEqual({ x: -1, y: 0 })
    expect(movementVectorFromKeys({ ...NONE, right: true })).toEqual({ x: 1, y: 0 })
  })

  it('T11: no keys gives zero', () => {
    expect(movementVectorFromKeys(NONE)).toEqual({ x: 0, y: 0 })
  })

  it('T11: opposite keys cancel', () => {
    expect(movementVectorFromKeys({ ...NONE, up: true, down: true })).toEqual({ x: 0, y: 0 })
    expect(movementVectorFromKeys({ ...NONE, left: true, right: true })).toEqual({ x: 0, y: 0 })
    expect(movementVectorFromKeys({ up: true, down: true, left: true, right: true })).toEqual({
      x: 0,
      y: 0,
    })
    // one axis cancelled, the other still moves at full length
    expect(movementVectorFromKeys({ up: true, down: true, left: false, right: true })).toEqual({
      x: 1,
      y: 0,
    })
  })

  it('T11: diagonals are normalized to length 1', () => {
    for (const keys of [
      { ...NONE, up: true, left: true },
      { ...NONE, up: true, right: true },
      { ...NONE, down: true, left: true },
      { ...NONE, down: true, right: true },
    ]) {
      const v = movementVectorFromKeys(keys)
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 12)
    }
    const ur = movementVectorFromKeys({ ...NONE, up: true, right: true })
    expect(ur.x).toBeGreaterThan(0)
    expect(ur.y).toBeLessThan(0)
  })
})
