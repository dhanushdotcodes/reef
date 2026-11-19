import { createNoise2D } from 'simplex-noise'
import { mulberry32 } from './random'
import { TERRAIN } from '../config'

const noise = createNoise2D(mulberry32(1337))

/** Single source of truth for seabed height. Used by the mesh and for snapping. */
export function sandHeight(x: number, z: number): number {
  const big = noise(x * 0.07, z * 0.07) * 0.9
  const mid = noise(x * 0.18 + 40, z * 0.18 - 17) * 0.28
  const small = noise(x * 0.6 - 9, z * 0.6 + 3) * 0.04
  const ripple = Math.sin(x * 1.3 + noise(x * 0.3, z * 0.3) * 4) * 0.05
  // keep the play area gently flat, rise toward the far edges
  const r = Math.hypot(x, z)
  const bowl = Math.max(0, r - TERRAIN.flatRadius) * 0.05
  const flatten = 0.45 + 0.55 * Math.min(1, r / TERRAIN.flatRadius)
  return (big + mid) * flatten + small + ripple + bowl - 0.2
}

/** Ray vs heightfield: march then bisect. Much cheaper than raycasting 80k triangles. */
export function intersectTerrain(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  out: [number, number, number],
): boolean {
  const maxT = 90
  const step = 0.6
  let prevT = 0
  let t = 0
  let found = false
  while (t < maxT) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t
    if (y < sandHeight(x, z)) { found = true; break }
    prevT = t
    t += step
  }
  if (!found) return false
  let lo = prevT, hi = t
  for (let i = 0; i < 10; i++) {
    const m = (lo + hi) / 2
    const x = ox + dx * m, y = oy + dy * m, z = oz + dz * m
    if (y < sandHeight(x, z)) hi = m
    else lo = m
  }
  const x = ox + dx * hi, z = oz + dz * hi
  out[0] = x
  out[1] = sandHeight(x, z)
  out[2] = z
  return true
}
