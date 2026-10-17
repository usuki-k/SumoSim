// Converts variable render frame deltas into a whole number of fixed simulation ticks.
// Pure TypeScript; must not import Phaser.

export interface FixedStepOptions {
  readonly stepMs: number
  // Frame deltas above this are clamped (tab switch, long stall).
  readonly maxFrameMs: number
  // Upper bound on ticks per frame; excess accumulated time is discarded (slow motion, no spiral of death).
  readonly maxStepsPerFrame: number
}

const EPSILON_MS = 1e-6

export class FixedStepAccumulator {
  private accumulatedMs = 0
  private readonly options: FixedStepOptions

  constructor(options: FixedStepOptions) {
    this.options = options
  }

  // Returns how many ticks to run for this frame.
  advance(deltaMs: number): number {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0
    this.accumulatedMs += Math.min(deltaMs, this.options.maxFrameMs)

    let steps = 0
    while (
      this.accumulatedMs + EPSILON_MS >= this.options.stepMs &&
      steps < this.options.maxStepsPerFrame
    ) {
      this.accumulatedMs -= this.options.stepMs
      steps++
    }
    if (steps >= this.options.maxStepsPerFrame) {
      this.accumulatedMs = 0
    }
    return steps
  }
}
