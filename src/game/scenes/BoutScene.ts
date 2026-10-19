import Phaser from 'phaser'
import { movementVectorFromKeys } from '../input/movementVector.ts'
import { PressLatch } from '../input/pressLatch.ts'
import { PushDummyController, type DummyMode } from '../input/pushDummyController.ts'
import { BoutSimulation, SIMULATION_HZ } from '../sumo/BoutSimulation.ts'
import { FixedStepAccumulator } from '../sumo/FixedStepAccumulator.ts'
import type {
  BoutSetup,
  ParticipantActionState,
  ParticipantId,
  ParticipantIntent,
  ParticipantPosture,
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
}
const PARTICIPANT_PRESENTATION: readonly ParticipantPresentation[] = [
  { id: 'wrestler-a', controller: 'keyboard', color: 0x2f6fdb, label: 'PLAYER' },
  { id: 'wrestler-b', controller: 'dummy', color: 0xd93f3f, label: 'CPU' },
]

// Provisional presentation values.
const RING_FILL_RATIO = 0.9 // ring radius as a fraction of half the canvas

// Accumulator limits (provisional safety values).
const MAX_FRAME_MS = 250
const MAX_STEPS_PER_FRAME = 8

interface ParticipantView {
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
  if (action.kind !== 'push') return ''
  if (action.phase === 'startup') return 'STARTUP'
  if (action.phase === 'active') return 'PUSH'
  return 'RECOVERY'
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
  // Prototype binding: ArrowUp = Push (temporary, not the final control scheme).
  private readonly pushLatch = new PressLatch()
  // Prototype binding: ArrowDown = Counter (temporary, not the final control scheme).
  private readonly counterLatch = new PressLatch()
  // Prototype test harness (not CPU AI): drives the CPU participant; mode keys 1 / 2.
  private readonly dummy = new PushDummyController('wrestler-b', 'wrestler-a')
  private modeText: Phaser.GameObjects.Text | null = null
  private views = new Map<ParticipantId, ParticipantView>()
  private pixelsPerMeter = 1
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
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP).on('down', () => this.pushLatch.press())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN).on('down', () => this.counterLatch.press())
      // Prototype convenience: R restarts from the prototype setup.
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.restart())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.setDummyMode('stationary'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.setDummyMode('push'))
    }

    const snapshot = this.simulation.getSnapshot()

    // Presentation transform: simulation meters -> canvas pixels (scale + translate).
    this.origin = { x: this.scale.width / 2, y: this.scale.height / 2 }
    this.pixelsPerMeter =
      (Math.min(this.scale.width, this.scale.height) / 2 * RING_FILL_RATIO) / snapshot.arena.radius

    const ringPixels = snapshot.arena.radius * this.pixelsPerMeter
    const ring = this.add.graphics()
    ring.fillStyle(0xc9a96e, 1)
    ring.fillCircle(this.origin.x, this.origin.y, ringPixels)
    ring.lineStyle(8, 0xf2e6c9, 1)
    ring.strokeCircle(this.origin.x, this.origin.y, ringPixels)

    for (const style of PARTICIPANT_PRESENTATION) {
      const radius = snapshot.participants.find((q) => q.id === style.id)?.bodyRadius ?? 0
      const bodyPixels = radius * this.pixelsPerMeter
      const body = this.add.circle(0, 0, bodyPixels, style.color).setStrokeStyle(3, 0xffffff)
      const facingMarker = this.add.circle(0, 0, bodyPixels * 0.25, 0xffffff)
      const label = this.add
        .text(0, 0, style.label, { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5)
      const phaseText = this.add
        .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffe08a' })
        .setOrigin(0.5)
      this.views.set(style.id, { body, facingMarker, label, phaseText })
    }
    this.modeText = this.add.text(12, 10, '', { fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff' })
    this.setDummyMode('stationary')
    this.syncViews()
  }

  update(_time: number, deltaMs: number): void {
    const ticks = this.accumulator.advance(deltaMs)
    if (ticks > 0) {
      // A latched press goes to the first tick of this frame only; a frame with 0 ticks keeps it.
      const pushPressed = this.pushLatch.consume()
      const counterPressed = this.counterLatch.consume()
      // Intents (incl. the dummy's) are built per tick from the current Snapshot, never reused per frame.
      for (let i = 0; i < ticks; i++) {
        this.simulation.step(this.collectIntents(i === 0 && pushPressed, i === 0 && counterPressed))
      }
    }
    this.syncViews()
  }

  private restart(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    this.pushLatch.clear()
    this.counterLatch.clear()
    this.dummy.reset() // keeps the selected dummy mode
    this.syncViews()
  }

  private setDummyMode(mode: DummyMode): void {
    this.dummy.setMode(mode)
    this.modeText?.setText(mode === 'push' ? 'DUMMY: PUSH  (1: stationary / 2: push / R: restart)' : 'DUMMY: STATIONARY  (1: stationary / 2: push / R: restart)')
  }

  private collectIntents(pushPressed: boolean, counterPressed: boolean): Map<ParticipantId, ParticipantIntent> {
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

  // One-way sync: simulation snapshot -> persistent GameObjects.
  private syncViews(): void {
    for (const participant of this.simulation.getSnapshot().participants) {
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
      view.phaseText.setText(phaseLabel(participant.action, participant.posture))
      view.phaseText.setPosition(pos.x, pos.y - bodyPixels - 38)
    }
  }
}
