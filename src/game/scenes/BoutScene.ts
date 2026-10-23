import Phaser from 'phaser'
import { movementVectorFromKeys } from '../input/movementVector.ts'
import { PressLatch } from '../input/pressLatch.ts'
import { PushDummyController, type DummyMode } from '../input/pushDummyController.ts'
import { BoutSimulation, SIMULATION_HZ, TSUPPARI_KUZUSHI_BUILDUP } from '../sumo/BoutSimulation.ts'
import { FixedStepAccumulator } from '../sumo/FixedStepAccumulator.ts'
import { canActInGrapple, grappleFacingError } from '../sumo/grappleOrientation.ts'
import { resolveWrestlerVisualState, type WrestlerVisualState } from '../presentation/wrestlerVisualState.ts'
import { ENGLISH_BOUT_HUD_COPY } from '../presentation/boutHudCopy.ts'
import { PROTOTYPE_HUD_FIXTURE, assertHudContextMatches, formatOutcome } from '../presentation/boutHudPresentation.ts'
import { PRODUCT_ART_CENTER, productPixelsPerMeter } from '../presentation/productArena.ts'
import { PRODUCT_WRESTLER_ART, type ProductWrestlerArtId } from '../presentation/productWrestlerArt.ts'
import { createBoutHud } from './BoutHudView.ts'
import { createPreBoutComparison } from './PreBoutComparisonView.ts'
import { addProductDohyo, drawArenaBoundaryDebug, preloadProductDohyo } from './DohyoView.ts'
import { WrestlerView, preloadProductWrestlers } from './WrestlerView.ts'
import type {
  BoutCounterTransition,
  BoutEngagement,
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
const RING_RADIUS = 2.275
// Accepted Product Tokudawara (ART-TOOL-02 Candidate C) on the four cardinal axes:
// depth = 2.275 * 42 / 800 m (art: 42 px over an 800 px radius), half angle 9 degrees.
const TOKUDAWARA_DEPTH = 0.1194375
const TOKUDAWARA_HALF_ANGLE = Math.PI / 20
const PROTOTYPE_SETUP: BoutSetup = {
  arena: { radius: RING_RADIUS, tokudawara: { depth: TOKUDAWARA_DEPTH, halfAngle: TOKUDAWARA_HALF_ANGLE } },
  participants: [
    { id: 'wrestler-a', position: { x: -0.7, y: 0 } },
    { id: 'wrestler-b', position: { x: 0.7, y: 0 } },
  ],
}

// Outside the simulation: which controller drives which participant, its Product wrestler art, its debug
// color and its debug label. Simulation participant ids are plain identities; roles live only here.
// Side / name / rank / record / day come only from the HUD presentation context (PROTOTYPE_HUD_FIXTURE).
type Controller = 'keyboard' | 'dummy'
interface ParticipantPresentation {
  readonly id: ParticipantId
  readonly controller: Controller
  // Authored rigid Product sprite (never tinted; the color is for debug overlays only).
  readonly art: ProductWrestlerArtId
  readonly color: number
  // Debug-only role label (key 0), not a wrestler name.
  readonly label: string
}
const PARTICIPANT_PRESENTATION: readonly ParticipantPresentation[] = [
  { id: 'wrestler-a', controller: 'keyboard', art: 'blue', color: 0x2f6fdb, label: 'PLAYER' },
  { id: 'wrestler-b', controller: 'dummy', art: 'red', color: 0xd93f3f, label: 'CPU' },
]

// Depths above the wrestler bodies (see WrestlerView): debug overlays, then texts.
const DEBUG_OVERLAY_DEPTH = 3
const TEXT_DEPTH = 4

// Accumulator limits (provisional safety values).
const MAX_FRAME_MS = 250
const MAX_STEPS_PER_FRAME = 8

// Scene-owned presentation phase (ACTION-ART-02B), not gameplay state: the pre-bout comparison is shown
// and the Simulation does not advance until the prototype start input (Enter).
type BoutPresentationPhase = 'pre-bout' | 'active'

interface ParticipantView {
  readonly wrestler: WrestlerView
  // Debug-only overlays (key 0): contact circle outline, facing marker, label, phase text.
  readonly body: Phaser.GameObjects.Arc
  readonly facingMarker: Phaser.GameObjects.Arc
  readonly label: Phaser.GameObjects.Text
  readonly phaseText: Phaser.GameObjects.Text
}

// Presentation-only label for the Counter user during a Counter transition (the pusher shows KUZUSHI).
function counterTransitionLabel(transition: BoutCounterTransition, id: ParticipantId): string {
  if (transition.kind !== 'active' || transition.counterUserId !== id) return ''
  return transition.tier === 'best' ? 'COUNTER BEST' : 'COUNTER SUCCESS'
}

// Presentation-only label for the current posture / action (stable idle shows nothing).
// Kuzushi takes priority (entering it cancels the action anyway).
function phaseLabel(action: ParticipantActionState, posture: ParticipantPosture): string {
  if (posture.kind === 'kuzushi') return 'KUZUSHI'
  if (action.kind === 'tsuppari') {
    const hand = action.hand === 'left' ? 'L' : 'R'
    if (action.strike === 'pending') return `TSU ${hand}`
    return `TSU ${hand} ${action.strike === 'hit' ? 'HIT' : 'WHIFF'}`
  }
  if (action.kind === 'counter') return 'COUNTER'
  if (action.kind === 'grip') return action.phase === 'reach' ? 'GRIP' : 'GRIP REC'
  if (action.kind === 'drive') return 'DRIVE'
  if (action.kind !== 'push') return ''
  if (action.phase === 'startup') return 'STARTUP'
  if (action.phase === 'active') return 'PUSH'
  return 'RECOVERY'
}

// Debug-only Tsuppari readout per participant: each hand's cooldown (seconds) and the successful-hit buildup.
function tsuppariLabel(participant: ParticipantState): string {
  const hand = (ticks: number) => (ticks === 0 ? 'ok' : `${(ticks / SIMULATION_HZ).toFixed(1)}s`)
  const { left, right } = participant.tsuppariCooldown
  const label = PARTICIPANT_PRESENTATION.find((style) => style.id === participant.id)?.label ?? participant.id
  return `${label} TSU  L ${hand(left)}  R ${hand(right)}  hits ${participant.tsuppariBuildup}/${TSUPPARI_KUZUSHI_BUILDUP}`
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

// The keyboard participant's press edges for one tick (consumed latches).
type ActionEdges = Pick<
  ParticipantIntent,
  'pushPressed' | 'tsuppariLeftPressed' | 'tsuppariRightPressed' | 'counterPressed' | 'gripPressed'
>
const NO_EDGES: ActionEdges = {
  pushPressed: false,
  tsuppariLeftPressed: false,
  tsuppariRightPressed: false,
  counterPressed: false,
  gripPressed: false,
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
  // Prototype binding: ArrowLeft / ArrowRight = left-hand / right-hand Tsuppari (temporary).
  private readonly tsuppariLeftLatch = new PressLatch()
  private readonly tsuppariRightLatch = new PressLatch()
  // Prototype test harness (not CPU AI): drives the CPU participant; mode keys 1 / 2 / 3.
  private readonly dummy = new PushDummyController('wrestler-b', 'wrestler-a')
  private modeText: Phaser.GameObjects.Text | null = null
  private engagementText: Phaser.GameObjects.Text | null = null
  // Debug-only Tsuppari cooldown / buildup line (key 0).
  private tsuppariText: Phaser.GameObjects.Text | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private grappleLine: Phaser.GameObjects.Graphics | null = null
  private boundaryLine: Phaser.GameObjects.Graphics | null = null
  private views = new Map<ParticipantId, ParticipantView>()
  private phase: BoutPresentationPhase = 'pre-bout'
  private hud: Phaser.GameObjects.Container | null = null
  private comparison: Phaser.GameObjects.Container | null = null
  private pixelsPerMeter = 1
  // Prototype debug display toggle (key 0). Off = game-readable view.
  private debug = false
  private dummyMode: DummyMode = 'stationary'
  private origin: Vec2 = { x: 0, y: 0 }

  constructor() {
    super('BoutScene')
  }

  preload(): void {
    preloadProductDohyo(this)
    preloadProductWrestlers(this)
  }

  create(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    this.accumulator = this.newAccumulator()

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
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on('down', () => this.tsuppariLeftLatch.press())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on('down', () => this.tsuppariRightLatch.press())
      // Prototype convenience: R restarts from the prototype setup.
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.restart())
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.setDummyMode('stationary'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.setDummyMode('push'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE).on('down', () => this.setDummyMode('tsuppari'))
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO).on('down', () => this.setDebug(!this.debug))
      // Prototype-only start input for the pre-bout comparison (not the final control scheme).
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER).on('down', () => this.startBout())
    }

    const snapshot = this.simulation.getSnapshot()

    // Presentation transform: simulation meters -> Product art pixels (scale + translate). The
    // logical canvas is the 1920x1080 art space, so the Simulation origin is the art ring center and the
    // Simulation radius lands on the art ring radius.
    this.origin = { x: PRODUCT_ART_CENTER.x, y: PRODUCT_ART_CENTER.y }
    this.pixelsPerMeter = productPixelsPerMeter(snapshot.arena)

    addProductDohyo(this, this.origin)
    // Product HUD shell from the prototype fixture (joined to the bout by participant id only).
    assertHudContextMatches(PROTOTYPE_HUD_FIXTURE, snapshot.participants.map((p) => p.id))
    // Initial release ships English HUD copy only.
    this.hud = createBoutHud(this, PROTOTYPE_HUD_FIXTURE, ENGLISH_BOUT_HUD_COPY)
    this.comparison = createPreBoutComparison(this, PROTOTYPE_HUD_FIXTURE, ENGLISH_BOUT_HUD_COPY)
    this.boundaryLine = drawArenaBoundaryDebug(this, this.origin, this.pixelsPerMeter, snapshot.arena).setDepth(DEBUG_OVERLAY_DEPTH)

    for (const style of PARTICIPANT_PRESENTATION) {
      const radius = snapshot.participants.find((q) => q.id === style.id)?.bodyRadius ?? 0
      const bodyPixels = radius * this.pixelsPerMeter
      const wrestler = new WrestlerView(this, bodyPixels, PRODUCT_WRESTLER_ART[style.art])
      const body = this.add.circle(0, 0, bodyPixels).setStrokeStyle(2, style.color).setDepth(DEBUG_OVERLAY_DEPTH)
      const facingMarker = this.add.circle(0, 0, bodyPixels * 0.2, 0xffffff).setDepth(DEBUG_OVERLAY_DEPTH)
      const label = this.add
        .text(0, 0, style.label, { fontFamily: 'sans-serif', fontSize: '32px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(TEXT_DEPTH)
      const phaseText = this.add
        .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffe08a', stroke: '#000000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(TEXT_DEPTH)
      this.views.set(style.id, { wrestler, body, facingMarker, label, phaseText })
    }
    this.grappleLine = this.add.graphics().setDepth(DEBUG_OVERLAY_DEPTH)
    // Debug-only texts sit bottom-left, clear of the HUD blocks and the Action critical circle.
    this.modeText = this.add.text(24, 1030, '', { fontFamily: 'sans-serif', fontSize: '26px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setDepth(TEXT_DEPTH)
    this.engagementText = this.add.text(24, 986, '', { fontFamily: 'sans-serif', fontSize: '30px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setDepth(TEXT_DEPTH)
    this.tsuppariText = this.add.text(24, 944, '', { fontFamily: 'sans-serif', fontSize: '28px', color: '#b8f0ff', stroke: '#000000', strokeThickness: 4 }).setDepth(TEXT_DEPTH)
    this.resultText = this.add
      .text(this.scale.width / 2, 110, '', { fontFamily: 'sans-serif', fontSize: '64px', color: '#ffffff', stroke: '#000000', strokeThickness: 8 })
      .setOrigin(0.5, 0)
      .setDepth(TEXT_DEPTH)
    this.setDummyMode('stationary')
    this.setDebug(false)
    this.enterPreBout()
    this.syncViews()
  }

  update(_time: number, deltaMs: number): void {
    // Pre-bout: the Simulation does not step and no time is accumulated for a later burst.
    if (this.phase === 'pre-bout') {
      this.syncViews()
      return
    }
    const ticks = this.accumulator.advance(deltaMs)
    if (ticks > 0) {
      // A latched press goes to the first tick of this frame only; a frame with 0 ticks keeps it.
      const edges: ActionEdges = {
        pushPressed: this.pushLatch.consume(),
        tsuppariLeftPressed: this.tsuppariLeftLatch.consume(),
        tsuppariRightPressed: this.tsuppariRightLatch.consume(),
        counterPressed: this.counterLatch.consume(),
        gripPressed: this.gripLatch.consume(),
      }
      // Intents (incl. the dummy's) are built per tick from the current Snapshot, never reused per frame.
      for (let i = 0; i < ticks; i++) {
        this.simulation.step(this.collectIntents(i === 0 ? edges : NO_EDGES))
      }
    }
    this.syncViews()
  }

  private newAccumulator(): FixedStepAccumulator {
    return new FixedStepAccumulator({
      stepMs: 1000 / SIMULATION_HZ,
      maxFrameMs: MAX_FRAME_MS,
      maxStepsPerFrame: MAX_STEPS_PER_FRAME,
    })
  }

  // A new bout always begins at the pre-bout comparison.
  private restart(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    this.clearPressLatches()
    this.dummy.reset() // keeps the selected dummy mode
    this.enterPreBout()
    this.syncViews()
  }

  private enterPreBout(): void {
    this.phase = 'pre-bout'
    this.comparison?.setVisible(true)
    this.hud?.setVisible(false)
  }

  // Enter during pre-bout: hide the comparison, show the Action HUD and start ticking from a fresh
  // accumulator. Presses made while waiting are dropped so none fires on the first active tick.
  private startBout(): void {
    if (this.phase !== 'pre-bout') return
    this.phase = 'active'
    this.comparison?.setVisible(false)
    this.hud?.setVisible(true)
    this.clearPressLatches()
    this.accumulator = this.newAccumulator()
  }

  private clearPressLatches(): void {
    this.pushLatch.clear()
    this.counterLatch.clear()
    this.gripLatch.clear()
    this.tsuppariLeftLatch.clear()
    this.tsuppariRightLatch.clear()
  }

  private setDummyMode(mode: DummyMode): void {
    this.dummy.setMode(mode)
    this.dummyMode = mode
    this.updateModeText()
  }

  // Debug overlays (labels, phase text, engagement readout, Dummy mode / control help, contact outline,
  // facing marker, grapple line, exact ring-out boundary) are hidden in the default Product view and
  // shown with key 0. The Product HUD stays visible either way.
  private setDebug(on: boolean): void {
    this.debug = on
    for (const view of this.views.values()) {
      view.body.setVisible(on)
      view.facingMarker.setVisible(on)
      view.label.setVisible(on)
      view.phaseText.setVisible(on)
    }
    this.grappleLine?.setVisible(on)
    this.boundaryLine?.setVisible(on)
    this.engagementText?.setVisible(on)
    this.tsuppariText?.setVisible(on)
    this.modeText?.setVisible(on)
    this.updateModeText()
  }

  private updateModeText(): void {
    const dummy =
      this.dummyMode === 'push' ? 'DUMMY: PUSH' : this.dummyMode === 'tsuppari' ? 'DUMMY: TSUPPARI' : 'DUMMY: STATIONARY'
    this.modeText?.setText(
      `${dummy}   WASD move/rotate  Up push/drive  Left/Right tsuppari  Down counter  Shift grip  1/2/3 dummy  R restart  0 debug off`,
    )
  }

  private collectIntents(edges: ActionEdges): Map<ParticipantId, ParticipantIntent> {
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
          ...edges,
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
  private syncViews(): void {
    const snapshot = this.simulation.getSnapshot()
    const pairSpeed = Math.hypot(snapshot.participants[0].externalVelocity.x, snapshot.participants[0].externalVelocity.y)
    this.resultText?.setText(formatOutcome(snapshot.outcome, PROTOTYPE_HUD_FIXTURE, ENGLISH_BOUT_HUD_COPY))
    this.tsuppariText?.setText(snapshot.participants.map(tsuppariLabel).join('     '))
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
    // Both visual states first: the Grip symbol VFX visibility is pair-level (ACTION-11J / 11K).
    const visuals = new Map<ParticipantId, WrestlerVisualState>()
    for (const participant of snapshot.participants) {
      const view = this.views.get(participant.id)
      const opponent = snapshot.participants.find((q) => q.id !== participant.id)
      if (view && opponent) {
        visuals.set(
          participant.id,
          resolveWrestlerVisualState(participant, opponent, snapshot.engagement, snapshot.outcome, view.wrestler.moving),
        )
      }
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
      view.label.setPosition(pos.x, pos.y - bodyPixels - 30)
      const opponent = snapshot.participants.find((q) => q.id !== participant.id)
      const visual = visuals.get(participant.id)
      const opponentVisual = opponent ? visuals.get(opponent.id) : undefined
      if (visual && opponentVisual) view.wrestler.apply(visual, participant, pos, opponentVisual)
      const label =
        counterTransitionLabel(snapshot.counterTransition, participant.id) || phaseLabel(participant.action, participant.posture)
      view.phaseText.setText(label !== '' || !opponent ? label : grappleLabel(participant, opponent, snapshot.engagement))
      view.phaseText.setPosition(pos.x, pos.y - bodyPixels - 66)
    }
  }
}
