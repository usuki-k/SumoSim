// Prototype validation harness for contested Push and Tsuppari (NOT a CPU AI): a deterministic opponent
// that emits the same semantic ParticipantIntent as the player each Simulation tick. Pure; no Phaser.
// It reads Snapshot geometry / cooldowns only and never touches Simulation state.
import type { BoutSnapshot, ParticipantId, ParticipantIntent } from '../sumo/BoutTypes.ts'

export type DummyMode = 'stationary' | 'push' | 'tsuppari'

// Idle ticks to wait after a Push finishes before the next edge (~500 ms at 60 Hz); provisional.
export const DUMMY_PUSH_COOLDOWN_TICKS = 30

// Test-harness proximity: "close enough to count as Contact" (meters). Deliberately local to the
// harness rather than reusing Simulation contact internals; larger than the Simulation slop.
export const DUMMY_CONTACT_TOLERANCE = 0.02

// Tsuppari mode: center distance (meters) the harness closes to before striking. A conservative harness
// value well inside the Simulation's Tsuppari reach (which alone decides hit / whiff).
export const DUMMY_TSUPPARI_RANGE = 0.8
// Tsuppari mode: wait while the opponent recedes faster than this (m/s), e.g. still sliding from the last
// hit, so a strike started now is not a predictable whiff.
export const DUMMY_TSUPPARI_RECEDE_SPEED = 0.1

const NO_INPUT: ParticipantIntent = {
  move: { x: 0, y: 0 },
  pushPressed: false,
  tsuppariLeftPressed: false,
  tsuppariRightPressed: false,
  counterPressed: false,
  gripPressed: false,
  driveHeld: false,
}
// Grappled harness input: no movement or FREE edges, Drive held (the Simulation only lets it count while READY).
const GRAPPLED_DRIVE: ParticipantIntent = { ...NO_INPUT, driveHeld: true }

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

    // Counter transition: every input is ignored by the Simulation; wait it out with a full cooldown so
    // nothing fires on the first tick after it.
    if (snapshot.counterTransition.kind === 'active') {
      this.cooldownTicks = DUMMY_PUSH_COOLDOWN_TICKS
      return NO_INPUT
    }

    // Grappled: hold Drive (ACTION-05C1) and keep the Push cooldown full; never Grip / Release.
    if (snapshot.engagement.kind === 'grappled') {
      this.cooldownTicks = DUMMY_PUSH_COOLDOWN_TICKS
      return GRAPPLED_DRIVE
    }
    if (self.action.kind !== 'idle' || self.posture.kind === 'kuzushi') {
      this.cooldownTicks = DUMMY_PUSH_COOLDOWN_TICKS
      return NO_INPUT
    }

    const dx = target.position.x - self.position.x
    const dy = target.position.y - self.position.y
    const distance = Math.hypot(dx, dy)
    const approach: ParticipantIntent = { ...NO_INPUT, move: { x: dx / distance, y: dy / distance } }

    // Tsuppari: close to DUMMY_TSUPPARI_RANGE, then strike with a ready hand (Left first, else Right) once
    // the opponent is not receding; the hand cooldowns come from the Snapshot (no harness cooldown).
    if (this.mode === 'tsuppari') {
      if (distance > DUMMY_TSUPPARI_RANGE) return approach
      const receding = (target.velocity.x * dx + target.velocity.y * dy) / distance
      if (receding > DUMMY_TSUPPARI_RECEDE_SPEED) return NO_INPUT
      if (self.tsuppariCooldown.left === 0) return { ...NO_INPUT, tsuppariLeftPressed: true }
      if (self.tsuppariCooldown.right === 0) return { ...NO_INPUT, tsuppariRightPressed: true }
      return NO_INPUT
    }

    const inContact = distance <= self.bodyRadius + target.bodyRadius + DUMMY_CONTACT_TOLERANCE
    if (!inContact) {
      if (this.cooldownTicks > 0) this.cooldownTicks--
      return approach
    }
    if (this.cooldownTicks > 0) {
      this.cooldownTicks--
      return NO_INPUT
    }
    return { ...NO_INPUT, pushPressed: true }
  }
}
