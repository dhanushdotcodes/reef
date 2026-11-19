import { sandHeight } from '../../utils/terrain'
import { FISH_BOUNDS } from '../../config'
import type { Species } from './fishGeometry'

export interface Obstacle { x: number; z: number; r: number; top: number }

/** Approximate heights of grounded elements, used for fish avoidance. */
export const OBSTACLE_HEIGHT: Record<string, number> = { rock: 1.0, coral: 1.8, kelp: 3.5, wall: 2.2, shell: 0.3, chest: 0.8, bubbles: 0.7 }

/** CPU boids for one species. Plain typed arrays, no allocation per frame. */
export class Flock {
  ids: string[] = []
  px: Float32Array; py: Float32Array; pz: Float32Array
  vx: Float32Array; vy: Float32Array; vz: Float32Array
  boost: Float32Array
  phase: Float32Array
  version = 0
  private index = new Map<string, number>()

  readonly cap: number
  readonly species: Species

  constructor(cap: number, species: Species) {
    this.cap = cap
    this.species = species
    const f = () => new Float32Array(cap)
    this.px = f(); this.py = f(); this.pz = f()
    this.vx = f(); this.vy = f(); this.vz = f()
    this.boost = f(); this.phase = f()
  }
  get count() { return this.ids.length }
  has(id: string) { return this.index.has(id) }

  add(id: string, x: number, y: number, z: number) {
    if (this.ids.length >= this.cap || this.index.has(id)) return
    const i = this.ids.length
    this.ids.push(id)
    this.index.set(id, i)
    const a = Math.random() * Math.PI * 2
    const sp = this.species.maxSpeed
    this.px[i] = x; this.py[i] = y; this.pz[i] = z
    this.vx[i] = Math.cos(a) * sp; this.vy[i] = 0; this.vz[i] = Math.sin(a) * sp
    this.boost[i] = 1 // dart off after being dropped
    this.phase[i] = Math.random() * 100
    this.version++
  }

  remove(id: string) {
    const i = this.index.get(id)
    if (i === undefined) return
    const last = this.ids.length - 1
    if (i !== last) {
      const moved = this.ids[last]
      this.ids[i] = moved
      this.index.set(moved, i)
      for (const a of [this.px, this.py, this.pz, this.vx, this.vy, this.vz, this.boost, this.phase]) a[i] = a[last]
    }
    this.ids.pop()
    this.index.delete(id)
    this.version++
  }

  indexOf(id: string) { return this.index.get(id) }

  step(dt: number, t: number, obstacles: Obstacle[]) {
    const n = this.ids.length
    const sp = this.species
    const B = FISH_BOUNDS.xz - 1.5
    const nr2 = sp.neighbor * sp.neighbor
    const sr2 = sp.sep * sp.sep
    const { px, py, pz, vx, vy, vz } = this
    for (let i = 0; i < n; i++) {
      const x = px[i], y = py[i], z = pz[i]
      let sx = 0, sy = 0, sz = 0
      let avx = 0, avy = 0, avz = 0, cx = 0, cy = 0, cz = 0, cnt = 0
      let near = -1, nearD = 1e9
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        const dx = x - px[j], dy = y - py[j], dz = z - pz[j]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < nearD) { nearD = d2; near = j }
        if (d2 > nr2) continue
        cnt++
        avx += vx[j]; avy += vy[j]; avz += vz[j]
        cx += px[j]; cy += py[j]; cz += pz[j]
        if (d2 < sr2 && d2 > 1e-4) {
          const k = 1 / d2
          sx += dx * k; sy += dy * k; sz += dz * k
        }
      }
      let ax = sx * 2.2, ay = sy * 2.2, az = sz * 2.2
      if (cnt > 0) {
        ax += (avx / cnt - vx[i]) * 0.9 + (cx / cnt - x) * 0.7
        ay += (avy / cnt - vy[i]) * 0.9 + (cy / cnt - y) * 0.7
        az += (avz / cnt - vz[i]) * 0.9 + (cz / cnt - z) * 0.7
      } else if (near >= 0) {
        // lonely: head for the nearest school-mate
        const d = Math.sqrt(nearD) || 1
        ax += ((px[near] - x) / d) * 1.6
        ay += ((py[near] - y) / d) * 1.6
        az += ((pz[near] - z) / d) * 1.6
      }
      // soft bounds
      if (x > B) ax -= (x - B) * 1.2; else if (x < -B) ax -= (x + B) * 1.2
      if (z > B) az -= (z - B) * 1.2; else if (z < -B) az -= (z + B) * 1.2
      if (y > FISH_BOUNDS.yMax) ay -= (y - FISH_BOUNDS.yMax) * 2
      const floor = sandHeight(x, z) + 0.6
      if (y < Math.max(FISH_BOUNDS.yMin, floor)) ay += (Math.max(FISH_BOUNDS.yMin, floor) - y) * 7
      // obstacles: push away from grounded elements
      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k]
        if (y > o.top + 0.5) continue
        const dx = x - o.x, dz = z - o.z
        const rr = o.r + 0.7 + sp.length
        const d2 = dx * dx + dz * dz
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.01
          const push = (1 - d / rr) * 9
          ax += (dx / d) * push
          az += (dz / d) * push
          if (y < o.top) ay += push * 0.5
        }
      }
      // wander
      const ph = this.phase[i]
      ax += Math.sin(t * 0.7 + ph) * 0.7
      az += Math.cos(t * 0.9 + ph * 1.3) * 0.7
      ay += Math.sin(t * 0.5 + ph * 2.1) * 0.3

      vx[i] += ax * dt; vy[i] += ay * dt; vz[i] += az * dt
      vy[i] *= 1 - Math.min(1, dt * 0.8)
      const b = this.boost[i]
      this.boost[i] = Math.max(0, b - dt * 0.8)
      const max = sp.maxSpeed * (1 + b * 0.9)
      const s = Math.hypot(vx[i], vy[i], vz[i]) || 1e-4
      const clamped = Math.min(max, Math.max(sp.minSpeed, s))
      const k = clamped / s
      vx[i] *= k; vy[i] *= k; vz[i] *= k
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt
    }
  }
}
