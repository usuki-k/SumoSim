import { describe, expect, it } from 'vitest'
import { PressLatch } from './pressLatch.ts'

describe('PressLatch', () => {
  it('T49: a press is consumed by exactly one tick', () => {
    const latch = new PressLatch()
    latch.press()
    expect(latch.consume()).toBe(true)
    expect(latch.consume()).toBe(false)
    expect(latch.consume()).toBe(false)
  })

  it('T49: a pending press survives frames with no ticks (nothing consumes it)', () => {
    const latch = new PressLatch()
    latch.press()
    // frames with 0 simulation ticks do not call consume()
    expect(latch.consume()).toBe(true)
  })

  it('T49: repeated presses before consumption collapse into one edge', () => {
    const latch = new PressLatch()
    latch.press()
    latch.press()
    expect(latch.consume()).toBe(true)
    expect(latch.consume()).toBe(false)
  })

  it('T49: a new press after consumption queues the next edge', () => {
    const latch = new PressLatch()
    latch.press()
    latch.consume()
    latch.press()
    expect(latch.consume()).toBe(true)
  })

  it('clear drops a pending press', () => {
    const latch = new PressLatch()
    latch.press()
    latch.clear()
    expect(latch.consume()).toBe(false)
  })
})
