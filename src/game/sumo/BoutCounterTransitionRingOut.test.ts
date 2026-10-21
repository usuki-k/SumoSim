// ACTION-04A4: a Counter transition tick resolves ring-out through the one shared resolver with both
// participants' straight per-tick segments, and adopts its result as-is (earliest exit, simultaneous
// Rematch). No transition geometry found by an offline search makes both exit on the same tick, so the
// resolver is wrapped here to observe its inputs and to inject those results.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BoutOutcome, ParticipantId, ParticipantIntent } from './BoutTypes.ts'

vi.mock('./ringOut.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./ringOut.ts')>()
  return { ...original, resolveArenaRingOut: vi.fn(original.resolveArenaRingOut) }
})

const { BODY_RADIUS, BoutSimulation, COUNTER_TRANSITION_TICKS } = await import('./BoutSimulation.ts')
const ringOut = await import('./ringOut.ts')
const resolver = vi.mocked(ringOut.resolveArenaRingOut)

const COMBINED = 2 * BODY_RADIUS
const idle: ParticipantIntent = { move: { x: 0, y: 0 }, pushPressed: false, tsuppariLeftPressed: false, tsuppariRightPressed: false, counterPressed: false, gripPressed: false, driveHeld: false }

function caught() {
  const sim = new BoutSimulation({
    arena: { radius: 2.275 },
    participants: [
      { id: 'a', position: { x: -COMBINED / 2, y: 0 } },
      { id: 'b', position: { x: COMBINED / 2, y: 0 } },
    ],
  })
  for (let t = 0; sim.getSnapshot().counterTransition.kind === 'none'; t++) {
    sim.step(
      new Map<ParticipantId, ParticipantIntent>([
        ['a', { ...idle, counterPressed: t === 0 }],
        ['b', { ...idle, pushPressed: t === 0 }],
      ]),
    )
  }
  return sim
}

const IDLE = new Map<ParticipantId, ParticipantIntent>([
  ['a', idle],
  ['b', idle],
])

afterEach(() => {
  resolver.mockClear()
})

describe('Counter transition ring-out delegation (ACTION-04A4)', () => {
  it('passes both participants previous -> current segments to the shared resolver every transition tick', () => {
    const sim = caught()
    for (let k = 0; k < COUNTER_TRANSITION_TICKS; k++) {
      const prev = sim.getSnapshot()
      resolver.mockClear()
      sim.step(IDLE)
      const cur = sim.getSnapshot()
      expect(resolver).toHaveBeenCalledTimes(1)
      const [entries, arena] = resolver.mock.calls[0]
      expect(arena).toEqual({ radius: 2.275 })
      expect(entries.map((e) => [e.id, e.previous, e.current])).toEqual(
        cur.participants.map((p, i) => [p.id, prev.participants[i].position, p.position]),
      )
    }
  })

  for (const injected of [
    { kind: 'rematch', reason: 'simultaneous-ring-out' },
    { kind: 'win', winnerId: 'a', loserId: 'b', reason: 'ring-out' },
    { kind: 'win', winnerId: 'b', loserId: 'a', reason: 'ring-out' },
  ] as BoutOutcome[]) {
    it(`adopts the resolver result (${injected.kind === 'win' ? `${injected.loserId} exits first` : 'simultaneous exits'}) and freezes`, () => {
      const sim = caught()
      for (let k = 0; k < 10; k++) sim.step(IDLE)
      resolver.mockReturnValueOnce(injected)
      sim.step(IDLE)
      const decided = sim.getSnapshot()
      expect(decided.outcome).toEqual(injected)
      expect(decided.counterTransition).toMatchObject({ kind: 'active', ticksRemaining: COUNTER_TRANSITION_TICKS - 11 })
      sim.step(IDLE)
      expect(sim.getSnapshot()).toEqual(decided)
    })
  }
})
