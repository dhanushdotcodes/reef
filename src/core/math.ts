export const rand = (min: number, max: number): number => min + Math.random() * (max - min)

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Frame-rate independent smoothing factor for lerp: lerp(a, b, damp(rate, dt)). */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt)

/** Shortest signed angle difference. */
export const angleDelta = (from: number, to: number): number => {
  const turn = to - from
  return Math.atan2(Math.sin(turn), Math.cos(turn))
}
