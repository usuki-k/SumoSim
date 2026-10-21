import { describe, expect, it } from 'vitest'
import { BoutSimulation } from '../sumo/BoutSimulation.ts'
import type { ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'
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

// Scene-shaped driver: each frame consumes every latch once and hands the edges to its first tick.
function runFrames(plan: { ticks: number; pressDown?: boolean; pressUp?: boolean; pressShift?: boolean }[]): string[] {
  const sim = new BoutSimulation({
    arena: { radius: 100 },
    participants: [
      { id: 'a', position: { x: -2, y: 0 } },
      { id: 'b', position: { x: 2, y: 0 } },
    ],
  })
  const pushLatch = new PressLatch()
  const counterLatch = new PressLatch()
  const gripLatch = new PressLatch()
  const starts: string[] = []
  for (const frame of plan) {
    if (frame.pressDown) counterLatch.press()
    if (frame.pressUp) pushLatch.press()
    if (frame.pressShift) gripLatch.press()
    if (frame.ticks === 0) continue
    const pushPressed = pushLatch.consume()
    const counterPressed = counterLatch.consume()
    const gripPressed = gripLatch.consume()
    for (let i = 0; i < frame.ticks; i++) {
      const before = sim.getSnapshot().participants[0].action.kind
      sim.step(
        new Map<ParticipantId, ParticipantIntent>([
          ['a', { move: { x: 0, y: 0 }, pushPressed: i === 0 && pushPressed, tsuppariLeftPressed: false, tsuppariRightPressed: false, counterPressed: i === 0 && counterPressed, gripPressed: i === 0 && gripPressed, driveHeld: false }],
        ]),
      )
      const after = sim.getSnapshot().participants[0].action.kind
      if (before === 'idle' && after !== 'idle') starts.push(after)
    }
  }
  return starts
}

describe('ArrowDown Counter latch integration', () => {
  it('T77: a pending Down edge survives a 0-tick frame and reaches exactly one tick', () => {
    expect(runFrames([{ ticks: 0, pressDown: true }, { ticks: 4 }, { ticks: 4 }])).toEqual(['counter'])
  })

  it('T77: a multi-tick frame cannot repeat the edge; only a new press starts another attempt', () => {
    // one press, then 100 ticks of "holding" (no new key-down events) -> one attempt only
    const held = runFrames([{ ticks: 8, pressDown: true }, ...Array.from({ length: 23 }, () => ({ ticks: 4 }))])
    expect(held).toEqual(['counter'])
    const again = runFrames([
      { ticks: 8, pressDown: true },
      ...Array.from({ length: 12 }, () => ({ ticks: 4 })), // window + Kuzushi have passed
      { ticks: 1, pressDown: true },
    ])
    expect(again).toEqual(['counter', 'counter'])
  })

  it('T77: Up and Down latched into the same frame -> Push wins, Counter is not queued', () => {
    expect(runFrames([{ ticks: 2, pressDown: true, pressUp: true }, ...Array.from({ length: 20 }, () => ({ ticks: 4 }))])).toEqual(['push'])
  })
})

describe('Shift Grip latch integration (ACTION-05A)', () => {
  it('T111: a pending Shift edge survives a 0-tick frame and starts exactly one Grip', () => {
    expect(runFrames([{ ticks: 0, pressShift: true }, { ticks: 4 }, { ticks: 4 }])).toEqual(['grip'])
  })

  it('T111: a held Shift (no new key-down) never repeats; a new press after Recovery does', () => {
    expect(runFrames([{ ticks: 8, pressShift: true }, ...Array.from({ length: 20 }, () => ({ ticks: 4 }))])).toEqual(['grip'])
    expect(
      runFrames([{ ticks: 8, pressShift: true }, ...Array.from({ length: 4 }, () => ({ ticks: 4 })), { ticks: 1, pressShift: true }]),
    ).toEqual(['grip', 'grip'])
  })

  it('T111: Up / Down / Shift latched into one frame -> Push > Counter > Grip', () => {
    const rest = Array.from({ length: 20 }, () => ({ ticks: 4 }))
    expect(runFrames([{ ticks: 2, pressUp: true, pressDown: true, pressShift: true }, ...rest])).toEqual(['push'])
    expect(runFrames([{ ticks: 2, pressDown: true, pressShift: true }, ...rest]).at(0)).toBe('counter')
  })
})
