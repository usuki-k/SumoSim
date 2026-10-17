// Holds one pending press edge between a key-down event and the next simulation tick.
// A press is consumed by exactly one tick; extra presses before consumption collapse into one.
// Pure; no Phaser, no key codes (the caller wires key-down events to `press()`).
export class PressLatch {
  private pending = false

  press(): void {
    this.pending = true
  }

  // Returns true once per latched press, then false until the next press.
  consume(): boolean {
    const wasPending = this.pending
    this.pending = false
    return wasPending
  }

  clear(): void {
    this.pending = false
  }
}
