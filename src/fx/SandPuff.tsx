import { ParticlePool, KIND_SOFT } from './ParticlePool'
import type { Vec3 } from '../types'

const SAND: [number, number, number][] = [
  [0.46, 0.41, 0.31],
  [0.4, 0.36, 0.28],
  [0.52, 0.47, 0.36],
]

/** 40 particles burst radially outward + slightly up, then settle with water drag. */
export function emitSandPuff(pool: ParticlePool, pos: Vec3, strength = 1, low = false) {
  const n = Math.max(10, Math.round((low ? 24 : 40) * strength))
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = (2.2 + Math.random() * 3.4) * Math.sqrt(strength)
    const c = SAND[i % 3]
    pool.emit({
      x: pos[0] + Math.cos(a) * 0.2, y: pos[1] + 0.08, z: pos[2] + Math.sin(a) * 0.2,
      vx: Math.cos(a) * sp, vy: 1.0 + Math.random() * 1.8, vz: Math.sin(a) * sp,
      r: c[0], g: c[1], b: c[2], a: 0.32,
      size: (0.32 + Math.random() * 0.4) * Math.sqrt(strength),
      life: 1.1 + Math.random() * 0.8,
      drag: 0.92, gravity: -0.7, grow: 0.7, kind: KIND_SOFT, floorY: pos[1] + 0.02,
    })
  }
}
