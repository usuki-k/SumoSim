// Presentation-only mapping from canonical Snapshot state to a wrestler visual state (VISUAL-01A).
// Pure TypeScript; must not import Phaser. It reads gameplay state and existing pure helpers only and
// never decides anything about gameplay.
import {
  COUNTER_WINDOW_TICKS,
  GRIP_REACH_TICKS,
  GRIP_RECOVERY_TICKS,
  KUZUSHI_TICKS,
  PUSH_ACTIVE_TICKS,
  PUSH_RECOVERY_TICKS,
  PUSH_STARTUP_TICKS,
  TSUPPARI_ACTIVE_TICKS,
  TSUPPARI_RECOVERY_TICKS,
  TSUPPARI_STARTUP_TICKS,
} from '../sumo/BoutSimulation.ts'
import type {
  BoutEngagement,
  BoutOutcome,
  GripPhase,
  ParticipantState,
  PushPhase,
  TsuppariHand,
  TsuppariPhase,
} from '../sumo/BoutTypes.ts'
import { canActInGrapple } from '../sumo/grappleOrientation.ts'

export type WrestlerVisualPose =
  | 'idle'
  | 'move'
  | 'push'
  | 'tsuppari'
  | 'counter'
  | 'kuzushi'
  | 'grip'
  | 'grapple'
  | 'drive'

export type GrappleVisualRole = 'none' | 'neutral' | 'morozashi-holder' | 'morozashi-disadvantaged'

export interface WrestlerVisualState {
  readonly pose: WrestlerVisualPose
  readonly pushPhase: PushPhase | null
  readonly gripPhase: GripPhase | null
  // Tsuppari only: the striking hand and its phase (the later pose art picks its texture from these).
  readonly tsuppariHand: TsuppariHand | null
  readonly tsuppariPhase: TsuppariPhase | null
  // 0 at the start of the current gameplay phase, approaching 1 at its end (from ticksRemaining).
  readonly phaseProgress: number
  readonly grappleRole: GrappleVisualRole
  // Grappled but not yet READY (still turning to face the opponent).
  readonly turning: boolean
  // The bout is decided: time-based visual motion stops (no generic finish pose).
  readonly frozen: boolean
  // Own footwork speed (m/s): total velocity minus the externally induced part.
  readonly locomotionSpeed: number
  // Kuzushi remaining strength, 1 when just entered -> 0 when about to recover; 0 when stable.
  readonly kuzushiStrength: number
}

// Presentation hysteresis so the body does not flicker between idle and move (m/s).
export const MOVE_ENTER_SPEED = 0.2
export const MOVE_EXIT_SPEED = 0.1

function progress(ticksRemaining: number, phaseTicks: number): number {
  return Math.min(1, Math.max(0, 1 - ticksRemaining / phaseTicks))
}

function grappleRole(self: ParticipantState, engagement: BoutEngagement): GrappleVisualRole {
  if (engagement.kind !== 'grappled') return 'none'
  if (engagement.advantage.kind === 'neutral') return 'neutral'
  return engagement.advantage.holderId === self.id ? 'morozashi-holder' : 'morozashi-disadvantaged'
}

const PUSH_PHASE_TICKS: Record<PushPhase, number> = {
  startup: PUSH_STARTUP_TICKS,
  active: PUSH_ACTIVE_TICKS,
  recovery: PUSH_RECOVERY_TICKS,
}
const GRIP_PHASE_TICKS: Record<GripPhase, number> = { reach: GRIP_REACH_TICKS, recovery: GRIP_RECOVERY_TICKS }
const TSUPPARI_PHASE_TICKS: Record<TsuppariPhase, number> = {
  startup: TSUPPARI_STARTUP_TICKS,
  active: TSUPPARI_ACTIVE_TICKS,
  recovery: TSUPPARI_RECOVERY_TICKS,
}

// Priority: (outcome = freeze modifier) > kuzushi > FREE push / tsuppari / counter / grip > grappled drive >
// grappled turning / ready role > locomotion (with hysteresis on `wasMoving`) > idle.
export function resolveWrestlerVisualState(
  self: ParticipantState,
  opponent: ParticipantState,
  engagement: BoutEngagement,
  outcome: BoutOutcome,
  wasMoving: boolean,
): WrestlerVisualState {
  const locomotionSpeed = Math.hypot(
    self.velocity.x - self.externalVelocity.x,
    self.velocity.y - self.externalVelocity.y,
  )
  const role = grappleRole(self, engagement)
  const turning = engagement.kind === 'grappled' && !canActInGrapple(self, opponent, engagement)
  const base = {
    pushPhase: null,
    gripPhase: null,
    tsuppariHand: null,
    tsuppariPhase: null,
    phaseProgress: 0,
    grappleRole: role,
    turning,
    frozen: outcome.kind !== 'ongoing',
    locomotionSpeed,
    kuzushiStrength: 0,
  }

  if (self.posture.kind === 'kuzushi') {
    return { ...base, pose: 'kuzushi', kuzushiStrength: Math.min(1, self.posture.ticksRemaining / KUZUSHI_TICKS) }
  }
  const action = self.action
  if (action.kind === 'push') {
    return {
      ...base,
      pose: 'push',
      pushPhase: action.phase,
      phaseProgress: progress(action.ticksRemaining, PUSH_PHASE_TICKS[action.phase]),
    }
  }
  if (action.kind === 'tsuppari') {
    return {
      ...base,
      pose: 'tsuppari',
      tsuppariHand: action.hand,
      tsuppariPhase: action.phase,
      phaseProgress: progress(action.ticksRemaining, TSUPPARI_PHASE_TICKS[action.phase]),
    }
  }
  if (action.kind === 'counter') {
    return { ...base, pose: 'counter', phaseProgress: progress(action.ticksRemaining, COUNTER_WINDOW_TICKS) }
  }
  if (action.kind === 'grip') {
    return {
      ...base,
      pose: 'grip',
      gripPhase: action.phase,
      phaseProgress: progress(action.ticksRemaining, GRIP_PHASE_TICKS[action.phase]),
    }
  }
  if (action.kind === 'drive') return { ...base, pose: 'drive' }
  if (engagement.kind === 'grappled') return { ...base, pose: 'grapple' }
  const moving = wasMoving ? locomotionSpeed > MOVE_EXIT_SPEED : locomotionSpeed > MOVE_ENTER_SPEED
  return { ...base, pose: moving ? 'move' : 'idle' }
}
