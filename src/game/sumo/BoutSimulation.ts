// Canonical owner of bout runtime state. Pure TypeScript; must not import Phaser.
import type { ArenaSetup, BoutSetup, BoutSnapshot, ParticipantState, Vec2 } from './BoutTypes.ts'

interface MutableParticipant {
  id: string
  position: { x: number; y: number }
}

function assertFiniteVec2(v: Vec2, label: string): void {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    throw new Error(`Invalid BoutSetup: ${label} must be finite`)
  }
}

export class BoutSimulation {
  private readonly arena: ArenaSetup
  private readonly participants: MutableParticipant[]

  constructor(setup: BoutSetup) {
    if (!Number.isFinite(setup.arena.radius) || setup.arena.radius <= 0) {
      throw new Error('Invalid BoutSetup: arena.radius must be a positive finite number')
    }
    if (setup.participants.length !== 2) {
      throw new Error('Invalid BoutSetup: exactly 2 participants are required')
    }
    const ids = new Set<string>()
    for (const p of setup.participants) {
      if (p.id === '') throw new Error('Invalid BoutSetup: participant id must not be empty')
      if (ids.has(p.id)) throw new Error(`Invalid BoutSetup: duplicate participant id "${p.id}"`)
      ids.add(p.id)
      assertFiniteVec2(p.position, `participant "${p.id}" position`)
    }

    // Copy so the caller's setup object is never aliased as canonical state.
    this.arena = { radius: setup.arena.radius }
    this.participants = setup.participants.map((p) => ({
      id: p.id,
      position: { x: p.position.x, y: p.position.y },
    }))
  }

  // Returns a fresh copy; mutating it never affects canonical state.
  getSnapshot(): BoutSnapshot {
    return {
      arena: { radius: this.arena.radius },
      participants: this.participants.map(
        (p): ParticipantState => ({ id: p.id, position: { x: p.position.x, y: p.position.y } }),
      ),
    }
  }
}
