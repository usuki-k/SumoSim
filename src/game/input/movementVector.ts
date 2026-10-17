// Converts directional key state into a world-frame movement vector (screen-relative:
// up = -y, down = +y, left = -x, right = +x). Pure; no Phaser, no key codes.
import type { Vec2 } from '../sumo/BoutTypes.ts'

export interface DirectionKeys {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
}

export function movementVectorFromKeys(keys: DirectionKeys): Vec2 {
  const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
  const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
  if (x !== 0 && y !== 0) {
    const d = Math.SQRT1_2
    return { x: x * d, y: y * d }
  }
  return { x, y }
}
