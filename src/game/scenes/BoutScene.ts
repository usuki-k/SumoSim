import Phaser from 'phaser'
import { movementVectorFromKeys } from '../input/movementVector.ts'
import { PressLatch } from '../input/pressLatch.ts'
import { PushDummyController, type DummyMode } from '../input/pushDummyController.ts'
import { BoutSimulation, SIMULATION_HZ } from '../sumo/BoutSimulation.ts'
import { FixedStepAccumulator } from '../sumo/FixedStepAccumulator.ts'
import { canActInGrapple, grappleFacingError } from '../sumo/grappleOrientation.ts'
import { resolveWrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import { drawDohyo } from './DohyoView.ts'
import { WrestlerView } from './WrestlerView.ts'
import type {
  BoutEngagement,
  BoutOutcome,
  BoutSetup,
  ParticipantActionState,
  ParticipantId,
  ParticipantIntent,
  ParticipantPosture,
  ParticipantState,
  Vec2,
} from '../sumo/BoutTypes.ts'

// Prototype fixture values (meters); not final gameplay values.
// Ring inner diameter of a real dohyo is about 4.55 m.
const PROTOTYPE_SETUP: BoutSetup = {
  arena: { radius: 2.275 },
  participants: [
    { id: 'wrestler-a', position: { x: -0.7, y: 0 } },
    { id: 'wrestler-b', position: { x: 0.7, y: 0 } },
  ],
}

// Outside the simulation: which controller drives which participant, and how it is presented.
// Simulation participant ids are plain identities; roles live only here.
type Controller = 'keyboard' | 'dummy'
interface ParticipantPresentation {
  readonly id: ParticipantId
  readonly controller: Controller
  readonly color: number
  readonly label: string
  // Presentation-only side for the result text (current Prototype assignment, not gameplay state).
  readonly side: 'EAST' | 'WEST'
  // Wrestler display name. Not set yet: the result text falls back to `label` (PLAYER / CPU), which
  // is a temporary Prototype fallback, not a wrestler name.
  readonly name?: string
}
const PARTICIPANT_PRESENTATION: readonly ParticipantPresentation[] = [
  { id: 'wrestler-a', controller: 'keyboard', color: 0x2f6fdb, label: 'PLAYER', side: 'EAST' },
  { id: 'wrestler-b', controller: 'dummy', color: 0xd93f3f, label: 'CPU', side: 'WEST' },
]

// Provisional presentation values.
const RING_FILL_RATIO = 0.9 // ring radius as a fraction of half the canvas

// Depths above the wrestler bodies (see WrestlerView): debug overlays, then texts.
const DEBUG_OVERLAY_DEPTH = 3
const TEXT_DEPTH = 4

// Accumulator limits (provisional safety values).
const MAX_FRAME_MS = 250
const MAX_STEPS_PER_FRAME = 8

interface ParticipantView {
  readonly wrestler: WrestlerView
  // Debug-only overlays (key 0): contact circle outline, facing marker, label, phase text.
  readonly body: Phaser.GameObjects.Arc
  readonly facingMarker: Phaser.GameObjects.Arc
  readonly label: Phaser.GameObjects.Text
  readonly phaseText: Phaser.GameObjects.Text
}

// Presentation-only label for the current posture / action (stable idle shows nothing).
// Kuzushi takes priority (entering it cancels the action anyway).
function phaseLabel(action: ParticipantActionState, posture: ParticipantPosture): string {
  if (posture.kind === 'kuzushi') return 'KUZUSHI'
  if (action.kind === 'counter') return 'COUNTER'
  if (action.kind === 'grip') return action.phase === 'reach' ? 'GRIP' : 'GRIP REC'
  if (action.kind === 'drive') return 'DRIVE'
  if (action.kind !== 'push') return ''
  if (action.phase === 'startup') return 'STARTUP'
  if (action.phase === 'active') return 'PUSH'
  return 'RECOVERY'
}

// Presentation-only engagement label (holder shown by its presentation label).
function engagementLabel(engagement: BoutEngagement): string {
  if (engagement.kind === 'free') return 'ENGAGE: FREE'
  if (engagement.advantage.kind === 'neutral') return 'ENGAGE: GRAPPLED'
  const holderId = engagement.advantage.holderId
  const holder = PARTICIPANT_PRESENTATION.find((style) => style.id === holderId)?.label ?? holderId
  return `ENGAGE: MOROZASHI (${holder})`
}

// Presentation-only grappled readiness via the shared Simulation helper (no formula duplicated here).
function grappleLabel(self: ParticipantState, opponent: ParticipantState, engagement: BoutEngagement): string {
  if (engagement.kind !== 'grappled') return ''
  if (canActInGrapple(self, opponent, engagement)) return 'READY'
  const degrees = Math.round((Math.abs(grappleFacingError(self.position, self.facing, opponent.position)) * 180) / Math.PI)
  return `TURNING ${degrees}°`
}

// Presentation-only result text formatted from the Simulation outcome (ids only) + presentation metadata.
function outcomeLabel(outcome: BoutOutcome): string {
  if (outcome.kind === 'ongoing') return ''
  if (outcome.kind === 'rematch') return 'Draw Rematch'
  const winner = PARTICIPANT_PRESENTATION.find((style) => style.id === outcome.winnerId)
  if (!winner) return `${outcome.winnerId} Win`
  return `${winner.side} ${winner.name ?? winner.label} Win`
}

interface MovementKeys {
  readonly up: Phaser.Input.Keyboard.Key
  readonly down: Phaser.Input.Keyboard.Key
  readonly left: Phaser.Input.Keyboard.Key
  readonly right: Phaser.Input.Keyboard.Key
}

// Presentation: reads input, drives fixed-step ticks, and mirrors the simulation snapshot.
// The simulation owns canonical state; nothing here is written back to it.
export class BoutScene extends Phaser.Scene {
  private simulation!: BoutSimulation
  private accumulator!: FixedStepAccumulator
  private keys: MovementKeys | null = null
  // ArrowUp: its key-down edge feeds the Push latch; its held state is the Drive effort.
  private upKey: Phaser.Input.Keyboard.Key | null = null
  // Prototype binding: ArrowUp = Push (temporary, not the final control scheme).
  private readonly pushLatch = new PressLatch()
  // Prototype binding: ArrowDown = Counter (temporary, not the final control scheme).
  private readonly counterLatch = new PressLatch()
  // Prototype binding: Shift (either side) = Grip while free / Release while grappled.
  private readonly gripLatch = new PressLatch()
  // Prototype test harness (not CPU AI): drives the CPU participant; mode keys 1 / 2.
  private readonly dummy = new PushDummyController('wrestler-b', 'wrestler-a')
  private modeText: Phaser.GameObjects.Text | null = null
  private engagementText: Phaser.GameObjects.Text | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private grappleLine: Phaser.GameObjects.Graphics | null = null
  private views = new Map<ParticipantId, ParticipantView>()
  private pixelsPerMeter = 1
  // Prototype debug display toggle (key 0). Off = game-readable view.
  private debug = false
  private dummyMode: DummyMode = 'stationary'
  private origin: Vec2 = { x: 0, y: 0 }

  constructor() {
    super('BoutScene')
  }

  create(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    this.accumulator = new FixedStepAccumulator({
      stepMs: 1000 / SIMULATION_HZ,
      maxFrameMs: MAX_FRAME_MS,
      maxStepsPerFrame: MAX_STEPS_PER_FRAME,
    })

    const keyboard = this.input.keyboard
    if (keyboard) {
      this.keys = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      }
      // Key 'down' fires once per physical press (no auto-repeat while held).
      this.upKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
      this.upKey.on('down', () => this.pushLatch.press())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => this.counterLatch.press())
      // SHIFT matches both the left and right Shift keys.
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT).on('down', () => this.gripLatch.press())
      // Prototype convenience: R restarts from the prototype setup.
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.restart())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.setDummyMode('stationary'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.setDummyMode('push'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO).on('down', () => this.setDebug(!this.debug))
    }

    const snapshot = this.simulation.getSnapshot()

    // Presentation transform: simulation meters -> canvas pixels (scale + translate).
    this.origin = { x: this.scale.width / 2, y: this.scale.height / 2 }
    this.pixelsPerMeter =
      (Math.min(this.scale.width, this.scale.height) / 2 * RING_FILL_RATIO) / snapshot.arena.radius

    drawDohyo(this, this.origin, this.pixelsPerMeter, snapshot.arena.radius)

    for (const style of PARTICIPANT_PRESENTATION) {
      const radius = snapshot.participants.find((q) => q.id === style.id)?.bodyRadius ?? 0
      const bodyPixels = radius * this.pixelsPerMeter
      const wrestler = new WrestlerView(this, bodyPixels, style.color)
      const body = this.add.circle(0, 0, bodyPixels).setStrokeStyle(2, style.color).setDepth(DEBUG_OVERLAY_DEPTH)
      const facingMarker = this.add.circle(0, 0, bodyPixels * 0.2, 0xffffff).setDepth(DEBUG_OVERLAY_DEPTH)
      const label = this.add
        .text(0, 0, style.label, { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(TEXT_DEPTH)
      const phaseText = this.add
        .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffe08a' })
        .setOrigin(0.5)
        .setDepth(TEXT_DEPTH)
      this.views.set(style.id, { wrestler, body, facingMarker, label, phaseText })
    }
    this.grappleLine = this.add.graphics().setDepth(DEBUG_OVERLAY_DEPTH)
    this.modeText = this.add.text(12, 10, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffffff' }).setDepth(TEXT_DEPTH)
    this.engagementText = this.add.text(12, 30, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff' }).setDepth(TEXT_DEPTH)
    this.resultText = this.add
      .text(this.scale.width / 2, 40, '', { fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5, 0)
      .setDepth(TEXT_DEPTH)
    this.setDummyMode('stationary')
    this.setDebug(false)
    this.syncViews(0)
  }

  update(_time: number, deltaMs: number): void {
    const ticks = this.accumulator.advance(deltaMs)
    if (ticks > 0) {
      // A latched press goes to the first tick of this frame only; a frame with 0 ticks keeps it.
      const pushPressed = this.pushLatch.consume()
      const counterPressed = this.counterLatch.consume()
      const gripPressed = this.gripLatch.consume()
      // Intents (incl. the dummy's) are built per tick from the current Snapshot, never reused per frame.
      for (let i = 0; i < ticks; i++) {
        this.simulation.step(
          this.collectIntents(i === 0 && pushPressed, i === 0 && counterPressed, i === 0 && gripPressed),
        )
      }
    }
    this.syncViews(deltaMs)
  }

  private restart(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    this.pushLatch.clear()
    this.counterLatch.clear()
    this.gripLatch.clear()
    this.dummy.reset() // keeps the selected dummy mode
    this.syncViews(0)
  }

  private setDummyMode(mode: DummyMode): void {
    this.dummy.setMode(mode)
    this.dummyMode = mode
    this.updateModeText()
  }

  // Debug overlays (labels, phase text, engagement readout, contact outline, facing marker, grapple
  // line) are hidden in the default game-readable view and shown with key 0.
  private setDebug(on: boolean): void {
    this.debug = on
    for (const view of this.views.values()) {
      view.body.setVisible(on)
      view.facingMarker.setVisible(on)
      view.label.setVisible(on)
      view.phaseText.setVisible(on)
    }
    this.grappleLine?.setVisible(on)
    this.engagementText?.setVisible(on)
    this.updateModeText()
  }

  private updateModeText(): void {
    const dummy = this.dummyMode === 'push' ? 'DUMMY: PUSH' : 'DUMMY: STATIONARY'
    this.modeText?.setText(
      this.debug
        ? `${dummy}  (1: stationary / 2: push / R: restart / Shift: grip / 0: debug off)`
        : `${dummy}   WASD move  Up push/drive  Down counter  Shift grip  1/2 dummy  R restart  0 debug`,
    )
  }

  private collectIntents(
    pushPressed: boolean,
    counterPressed: boolean,
    gripPressed: boolean,
  ): Map<ParticipantId, ParticipantIntent> {
    const intents = new Map<ParticipantId, ParticipantIntent>()
    const snapshot = this.simulation.getSnapshot()
    for (const style of PARTICIPANT_PRESENTATION) {
      if (style.controller === 'keyboard' && this.keys) {
        intents.set(style.id, {
          move: movementVectorFromKeys({
            up: this.keys.up.isDown,
            down: this.keys.down.isDown,
            left: this.keys.left.isDown,
            right: this.keys.right.isDown,
          }),
          pushPressed,
          counterPressed,
          gripPressed,
          driveHeld: this.upKey?.isDown ?? false,
        })
      } else if (style.controller === 'dummy') {
        intents.set(style.id, this.dummy.nextIntent(snapshot))
      }
    }
    return intents
  }

  private toCanvas(p: Vec2): Vec2 {
    return {
      x: this.origin.x + p.x * this.pixelsPerMeter,
      y: this.origin.y + p.y * this.pixelsPerMeter,
    }
  }

  // One-way sync: simulation snapshot -> persistent GameObjects (wrestler visuals + debug overlays).
  private syncViews(dtMs: number): void {
    const snapshot = this.simulation.getSnapshot()
    const pairSpeed = Math.hypot(snapshot.participants[0].externalVelocity.x, snapshot.participants[0].externalVelocity.y)
    this.resultText?.setText(outcomeLabel(snapshot.outcome))
    this.engagementText?.setText(
      snapshot.engagement.kind === 'grappled'
        ? `${engagementLabel(snapshot.engagement)}  pair v: ${pairSpeed.toFixed(2)} m/s`
        : engagementLabel(snapshot.engagement),
    )
    this.grappleLine?.clear()
    if (this.grappleLine && snapshot.engagement.kind === 'grappled') {
      const [p0, p1] = snapshot.participants.map((q) => this.toCanvas(q.position))
      const advantage = snapshot.engagement.advantage
      const holderColor =
        advantage.kind === 'morozashi'
          ? (PARTICIPANT_PRESENTATION.find((style) => style.id === advantage.holderId)?.color ?? 0xffffff)
          : 0xffffff
      this.grappleLine.lineStyle(advantage.kind === 'morozashi' ? 8 : 4, holderColor, 1)
      this.grappleLine.lineBetween(p0.x, p0.y, p1.x, p1.y)
    }
    for (const participant of snapshot.participants) {
      const view = this.views.get(participant.id)
      if (!view) continue
      const bodyPixels = participant.bodyRadius * this.pixelsPerMeter
      const pos = this.toCanvas(participant.position)
      view.body.setPosition(pos.x, pos.y)
      view.facingMarker.setPosition(
        pos.x + Math.cos(participant.facing) * bodyPixels * 0.8,
        pos.y + Math.sin(participant.facing) * bodyPixels * 0.8,
      )
      view.label.setPosition(pos.x, pos.y - bodyPixels - 18)
      const opponent = snapshot.participants.find((q) => q.id !== participant.id)
      if (opponent) {
        const visual = resolveWrestlerVisualState(participant, opponent, snapshot.engagement, snapshot.outcome, view.wrestler.moving)
        view.wrestler.apply(visual, participant, pos, dtMs)
      }
      const label = phaseLabel(participant.action, participant.posture)
      view.phaseText.setText(label !== '' || !opponent ? label : grappleLabel(participant, opponent, snapshot.engagement))
      view.phaseText.setPosition(pos.x, pos.y - bodyPixels - 38)
    }
  }
}
