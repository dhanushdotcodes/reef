import { ParticlePool, KIND_BUBBLE } from './ParticlePool'
import type { Vec3 } from '../types'

/** Bubbles rise and wobble. */
export function emitBubbles(pool: ParticlePool, pos: Vec3, count = 8, spread = 0.25) {
  for (let i = 0; i < count; i++) {
    pool.emit({
      x: pos[0] + (Math.random() - 0.5) * spread, y: pos[1] + Math.random() * 0.2, z: pos[2] + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 0.3, vy: 0.7 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 0.3,
      r: 0.85, g: 0.97, b: 1, a: 0.85,
      size: 0.08 + Math.random() * 0.12,
      life: 1.3 + Math.random() * 1.3,
      drag: 0.985, gravity: 0.25, grow: 0.15, kind: KIND_BUBBLE, wobble: 1.6,
    })
  }
}

const SPARKS = [[1, 0.85, 0.4], [0.7, 1, 1], [1, 0.75, 0.9]]
export function emitSparkles(pool: ParticlePool, pos: Vec3, strength = 1, color?: [number, number, number]) {
  const n = Math.round(8 * strength)
  for (let i = 0; i < n; i++) {
    const c = color ?? SPARKS[i % 3]
    const a = Math.random() * Math.PI * 2
    pool.emit({
      x: pos[0] + Math.cos(a) * 0.35, y: pos[1] + Math.random() * 0.8, z: pos[2] + Math.sin(a) * 0.35,
      vx: Math.cos(a) * 0.3, vy: 0.4 + Math.random() * 0.9, vz: Math.sin(a) * 0.3,
      r: c[0], g: c[1], b: c[2], a: 0.55,
      size: 0.1 + Math.random() * 0.1,
      life: 0.8 + Math.random() * 0.9,
      drag: 0.97, gravity: 0.1, grow: -0.3, kind: 2,
    })
  }
}
