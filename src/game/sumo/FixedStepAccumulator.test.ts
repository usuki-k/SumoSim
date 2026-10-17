import { describe, expect, it } from 'vitest'
import { FixedStepAccumulator } from './FixedStepAccumulator.ts'

const STEP_MS = 1000 / 60

function make(maxFrameMs = 250, maxStepsPerFrame = 8): FixedStepAccumulator {
  return new FixedStepAccumulator({ stepMs: STEP_MS, maxFrameMs, maxStepsPerFrame })
}

function totalTicks(acc: FixedStepAccumulator, deltas: number[]): number {
  return deltas.reduce((sum, d) => sum + acc.advance(d), 0)
}

describe('FixedStepAccumulator', () => {
  it('T7: same total elapsed time gives the same tick count regardless of frame partitioning', () => {
    const totalMs = 1000
    const single = totalTicks(make(), [totalMs].flatMap((t) => Array(10).fill(t / 10)))
    const at60 = totalTicks(make(), Array(60).fill(STEP_MS))
    const jittery = totalTicks(
      make(),
      Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 16 : 17.333333333)),
    )
    const at144 = totalTicks(make(), Array(144).fill(1000 / 144))
    const at30 = totalTicks(make(), Array(30).fill(1000 / 30))
    expect(single).toBe(60)
    expect(at60).toBe(60)
    expect(jittery).toBe(60)
    expect(at144).toBe(60)
    expect(at30).toBe(60)
  })

  it('T7: 16ms + 17ms equals 33ms in one frame', () => {
    const split = totalTicks(make(), [16, 17])
    const whole = totalTicks(make(), [33])
    expect(split).toBe(whole)
    expect(whole).toBe(1)
  })

  it('carries the remainder across frames', () => {
    const acc = make()
    expect(acc.advance(10)).toBe(0)
    expect(acc.advance(10)).toBe(1)
  })

  it('T7: a huge frame delta is clamped by maxFrameMs', () => {
    const acc = make(100, 100)
    expect(acc.advance(60_000)).toBe(6) // 100ms / 16.67ms
    expect(acc.advance(0)).toBe(0)
  })

  it('T7: maxStepsPerFrame caps ticks and discards the excess instead of spiralling', () => {
    const acc = make(1000, 3)
    expect(acc.advance(1000)).toBe(3)
    // excess was discarded: the next small frame does not release a backlog
    expect(acc.advance(1)).toBe(0)
  })

  it('ignores non-positive and non-finite deltas', () => {
    const acc = make()
    expect(acc.advance(0)).toBe(0)
    expect(acc.advance(-5)).toBe(0)
    expect(acc.advance(NaN)).toBe(0)
    expect(acc.advance(Infinity)).toBe(0)
  })
})
