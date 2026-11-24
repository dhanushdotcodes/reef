/**
 * Critically damped spring (exact closed-form step, stable for any dt).
 * Reaches the target as fast as possible without overshoot; `omega` ≈ 4 / settle-time.
 */
export class Spring {
  x: number
  v = 0
  target: number
  omega: number

  constructor(value: number, omega = 4) {
    this.x = value
    this.target = value
    this.omega = omega
  }

  step(dt: number) {
    const w = this.omega
    const x0 = this.x - this.target
    const v0 = this.v
    const e = Math.exp(-w * dt)
    const k = v0 + w * x0
    this.x = this.target + (x0 + k * dt) * e
    this.v = (v0 - w * k * dt) * e
    return this.x
  }
}
