export type Step = (dt: number, time: number) => void

/** Runs `step` every animation frame. `dt` is clamped; `time` is seconds since start. Returns a stop function. */
export function startLoop(step: Step): () => void {
  let frame = 0
  let previous = performance.now()
  let elapsed = 0

  const tick = (now: number) => {
    const dt = Math.min((now - previous) / 1000, 0.05)
    previous = now
    elapsed += dt
    step(dt, elapsed)
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return () => cancelAnimationFrame(frame)
}
