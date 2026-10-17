import Phaser from 'phaser'
import { BoutSimulation } from '../sumo/BoutSimulation.ts'
import type { BoutSetup, ParticipantId, Vec2 } from '../sumo/BoutTypes.ts'

// Prototype fixture values only; not final gameplay values.
const PROTOTYPE_SETUP: BoutSetup = {
  arena: { radius: 220 },
  participants: [
    { id: 'player', position: { x: -70, y: 0 } },
    { id: 'cpu', position: { x: 70, y: 0 } },
  ],
}

// Presentation-only styling per participant id.
const PARTICIPANT_STYLE: Record<ParticipantId, { color: number; label: string }> = {
  player: { color: 0x2f6fdb, label: 'PLAYER' },
  cpu: { color: 0xd93f3f, label: 'CPU' },
}

// Presentation: BoutScene renders the simulation snapshot; the simulation owns canonical state.
export class BoutScene extends Phaser.Scene {
  private simulation!: BoutSimulation

  constructor() {
    super('BoutScene')
  }

  create(): void {
    this.simulation = new BoutSimulation(PROTOTYPE_SETUP)
    const snapshot = this.simulation.getSnapshot()

    // Simulation origin maps to canvas center; 1 simulation unit = 1 canvas pixel (provisional).
    const origin = { x: this.scale.width / 2, y: this.scale.height / 2 }
    const toCanvas = (p: Vec2): Vec2 => ({ x: origin.x + p.x, y: origin.y + p.y })

    const center = toCanvas({ x: 0, y: 0 })
    const ring = this.add.graphics()
    ring.fillStyle(0xc9a96e, 1)
    ring.fillCircle(center.x, center.y, snapshot.arena.radius)
    ring.lineStyle(8, 0xf2e6c9, 1)
    ring.strokeCircle(center.x, center.y, snapshot.arena.radius)

    for (const participant of snapshot.participants) {
      const style = PARTICIPANT_STYLE[participant.id]
      const pos = toCanvas(participant.position)
      this.add.circle(pos.x, pos.y, 32, style.color).setStrokeStyle(3, 0xffffff)
      this.add
        .text(pos.x, pos.y - 52, style.label, {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    }
  }
}
