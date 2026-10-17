import Phaser from 'phaser'

// Presentation foundation only. Colors, positions and sizes are prototype placeholders.
export class BoutScene extends Phaser.Scene {
  constructor() {
    super('BoutScene')
  }

  create(): void {
    const { width, height } = this.scale
    const cx = width / 2
    const cy = height / 2

    const ring = this.add.graphics()
    ring.fillStyle(0xc9a96e, 1)
    ring.fillCircle(cx, cy, 220)
    ring.lineStyle(8, 0xf2e6c9, 1)
    ring.strokeCircle(cx, cy, 220)

    this.addPlaceholder(cx - 70, cy, 0x2f6fdb, 'PLAYER')
    this.addPlaceholder(cx + 70, cy, 0xd93f3f, 'CPU')
  }

  private addPlaceholder(x: number, y: number, color: number, label: string): void {
    this.add.circle(x, y, 32, color).setStrokeStyle(3, 0xffffff)
    this.add
      .text(x, y - 52, label, { fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff' })
      .setOrigin(0.5)
  }
}
