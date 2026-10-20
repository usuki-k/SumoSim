import './style.css'
import Phaser from 'phaser'
import { PRODUCT_ART_HEIGHT, PRODUCT_ART_WIDTH } from './game/presentation/productArena.ts'
import { BoutScene } from './game/scenes/BoutScene.ts'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#2b2b33',
  // Product presentation baseline: logical canvas = the 1920x1080 runtime art space (1:1 art pixels);
  // Scale.FIT sets the browser display size.
  width: PRODUCT_ART_WIDTH,
  height: PRODUCT_ART_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BoutScene],
})
