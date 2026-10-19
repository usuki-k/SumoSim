// Prototype validation harness for contested Push (NOT a CPU AI): a deterministic opponent that emits
// the same semantic ParticipantIntent as the player each Simulation tick. Pure; no Phaser.
// It reads Snapshot geometry only and never touches Simulation state.
import type { BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'

export type DummyMode = 'stationary' | 'push'

// Idle ticks to wait after a Push finishes before the next edge (~500 ms at 60 Hz); provisional.
export const DUMMY_PUSH_COOLDOWN_TICKS = 30

// Test-harness proximity: "close enough to count as Contact" (meters). Deliberately local to the
// harness rather than reusing Simulation contact internals; larger than the Simulation slop.
export const DUMMY_CONTACT_TOLERANCE = 0.02

const NO_INPUT: ParticipantIntent = { move: { x: 0, y: 0 }, pushPressed: false, counterPressed: false, gripPressed: false }

export class PushDummyController {
  private mode: DummyMode = 'stationary'
  // Idle ticks still to wait before the next Push edge. Held at the full cooldown while acting, in
  // Kuzushi or grappled, so it starts counting down on the first idle stable free tick afterwards.
  private cooldownTicks = 0

  private readonly selfId: ParticipantId
  private readonly targetId: ParticipantId

  constructor(selfId: ParticipantId, targetId: ParticipantId) {
    this.selfId = selfId
    this.targetId = targetId
  }

  getMode(): DummyMode {
    return this.mode
  }

  // Switching mode (or restarting) resets controller timing; the first Push is then immediately ready.
  setMode(mode: DummyMode): void {
    this.mode = mode
    this.cooldownTicks = 0
  }

  reset(): void {
    this.cooldownTicks = 0
  }

  // Call exactly once per Simulation tick with the Snapshot taken before that tick's step.
  nextIntent(snapshot: BoutSnapshot): ParticipantIntent {
    if (this.mode === 'stationary') return NO_INPUT
    const self = snapshot.participants.find((p) => p.id === this.selfId)
    const target = snapshot.participants.find((p) => p.id === this.targetId)
    if (!self || !target) return NO_INPUT

    // Grappled (ACTION-05A): the harness has no grappled actions; it waits and holds its cooldown.
    if (self.action.kind !== 'idle' || self.posture.kind === 'kuzushi' || snapshot.engagement.kind === 'grappled') {
      this.cooldownTicks = DUMMY_PUSH_COOLDOWN_TICKS
      return NO_INPUT
    }

    const dx = target.position.x - self.position.x
    const dy = target.position.y - self.position.y
    const distance = Math.hypot(dx, dy)
    const inContact = distance <= self.bodyRadius + target.bodyRadius + DUMMY_CONTACT_TOLERANCE

    if (!inContact) {
      if (this.cooldownTicks > 0) this.cooldownTicks--
      return { move: { x: dx / distance, y: dy / distance }, pushPressed: false, counterPressed: false, gripPressed: false }
    }
    if (this.cooldownTicks > 0) {
      this.cooldownTicks--
      return NO_INPUT
    }
    return { move: { x: 0, y: 0 }, pushPressed: true, counterPressed: false, gripPressed: false }
  }
}
