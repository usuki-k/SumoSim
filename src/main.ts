import './style.css'
import Phaser from 'phaser'
import { BoutScene } from './game/scenes/BoutScene.ts'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#2b2b33',
  // Provisional logical size for the foundation; not a final resolution decision.
  width: 640,
  height: 640,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BoutScene],
})
