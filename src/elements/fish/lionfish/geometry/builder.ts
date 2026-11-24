import * as THREE from 'three'

/**
 * Every lionfish vertex carries, besides position/normal/colour/uv:
 *
 *   aPivot (vec3)  point the vertex rotates about (fin root, jaw hinge, …).
 *                  For the body it is the vertex itself.
 *   aRig   (vec4)  x = rig type (RIG.*), y = s (0..1 across the fin, e.g. ray index),
 *                  z = w (distance along the ray/tentacle), w = 1 to bend with the
 *                  body wave at the vertex's own x, 0 to bend at the pivot's x.
 *   aPaint (vec3)  x = paint mode (PAINT.*), y/z = pattern coordinates.
 *
 * The vertex shader (shaders/swim.glsl.ts) reads these to fold, flare, sway and
 * swim each part; the fragment shader paints bands/spots from aPaint.
 */
export const RIG = { BODY: 0, DORSAL: 1, PECTORAL: 2, FLUTTER: 3, TENTACLE: 4, JAW: 5, RIGID: 6 } as const
export const PAINT = { BODY: 0, RAY: 1, COLOR: 2, SPOTS_BIG: 3, SPOTS_SMALL: 4 } as const

export type Rig = [type: number, s: number, w: number, bend: number]
export type Paint = [mode: number, a: number, b: number]

/** One named anatomy part (kept as an index range so GLB export can split it out). */
export class Part {
  readonly name: string
  pos: number[] = []
  col: number[] = []
  uv: number[] = []
  pivot: number[] = []
  rig: number[] = []
  paint: number[] = []
  idx: number[] = []

  constructor(name: string) {
    this.name = name
  }

  get count() { return this.pos.length / 3 }

  vert(p: THREE.Vector3, pivot: THREE.Vector3, rig: Rig, paint: Paint, color: THREE.Color, uv: [number, number] = [paint[1], paint[2]]) {
    this.pos.push(p.x, p.y, p.z)
    this.pivot.push(pivot.x, pivot.y, pivot.z)
    this.rig.push(...rig)
    this.paint.push(...paint)
    this.col.push(color.r, color.g, color.b)
    this.uv.push(uv[0], uv[1])
    return this.count - 1
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c)
  }

  /** a-b-c-d counter-clockwise when seen from the front. */
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d)
  }

  /** Area-weighted smooth normals over this part only. */
  normals(): number[] {
    const n = new Array<number>(this.pos.length).fill(0)
    const p = this.pos
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), f = new THREE.Vector3()
    for (let i = 0; i < this.idx.length; i += 3) {
      const a = this.idx[i] * 3, b = this.idx[i + 1] * 3, c = this.idx[i + 2] * 3
      e1.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2])
      e2.set(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2])
      f.crossVectors(e1, e2)
      for (const v of [a, b, c]) { n[v] += f.x; n[v + 1] += f.y; n[v + 2] += f.z }
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l
    }
    return n
  }
}

export interface PartRange { name: string; start: number; count: number }

/** A draw bucket (body / opaque fins / membranes): many parts merged into one geometry. */
export class Bucket {
  parts: Part[] = []

  part(name: string) {
    const p = new Part(name)
    this.parts.push(p)
    return p
  }

  toGeometry(): THREE.BufferGeometry {
    const cat = (f: (p: Part) => number[]) => this.parts.flatMap(f)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(cat((p) => p.pos), 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(cat((p) => p.normals()), 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cat((p) => p.col), 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(cat((p) => p.uv), 2))
    g.setAttribute('aPivot', new THREE.Float32BufferAttribute(cat((p) => p.pivot), 3))
    g.setAttribute('aRig', new THREE.Float32BufferAttribute(cat((p) => p.rig), 4))
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(cat((p) => p.paint), 3))
    const idx: number[] = []
    const ranges: PartRange[] = []
    let base = 0
    for (const p of this.parts) {
      ranges.push({ name: p.name, start: idx.length, count: p.idx.length })
      for (const i of p.idx) idx.push(i + base)
      base += p.count
    }
    g.setIndex(idx)
    g.userData.parts = ranges
    g.computeBoundingSphere()
    return g
  }
}

/**
 * Tapered tube along `curve`, sampled at `ts` (0..1). Radius goes r0 -> r1 and
 * the tip is closed with a single vertex. Used for spines, rays and tentacles.
 * `attrs(t, dist)` supplies pivot/rig/paint/colour per ring.
 */
export function taperedTube(
  part: Part,
  curve: THREE.Curve<THREE.Vector3>,
  ts: number[],
  r0: number,
  r1: number,
  radial: number,
  attrs: (t: number, dist: number) => { pivot: THREE.Vector3; rig: Rig; paint: Paint; color: THREE.Color },
) {
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), V = new THREE.Vector3()
  const total = curve.getLength()
  curve.getTangent(0, T)
  // any vector not parallel to T seeds the frame; then parallel-transport it
  N.set(0, 0, 1)
  if (Math.abs(T.z) > 0.9) N.set(1, 0, 0)
  const rings: number[] = []
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i]
    curve.getPoint(t, P)
    curve.getTangent(t, T)
    N.addScaledVector(T, -N.dot(T)).normalize()
    B.crossVectors(T, N)
    const r = THREE.MathUtils.lerp(r0, r1, t)
    const a = attrs(t, t * total)
    rings.push(part.count)
    for (let j = 0; j < radial; j++) {
      const phi = (j / radial) * Math.PI * 2
      V.copy(P).addScaledVector(N, Math.cos(phi) * r).addScaledVector(B, Math.sin(phi) * r)
      part.vert(V, a.pivot, a.rig, a.paint, a.color, [t, j / radial])
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial
      part.quad(rings[i] + j, rings[i] + j2, rings[i + 1] + j2, rings[i + 1] + j)
    }
  }
  // tip cap
  curve.getPoint(1, P)
  curve.getTangent(1, T)
  P.addScaledVector(T, r1)
  const a = attrs(1, total)
  const tip = part.vert(P, a.pivot, a.rig, a.paint, a.color, [1, 0])
  const last = rings[rings.length - 1]
  for (let j = 0; j < radial; j++) part.tri(last + j, last + ((j + 1) % radial), tip)
}

/** Evenly spaced parameter values 0..1 with `n` segments. */
export const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n)

/** Smooth 1D profile through (u, value) keys (Catmull-Rom with clamped ends). */
export function profile(keys: [number, number][]) {
  return (u: number) => {
    const n = keys.length
    if (u <= keys[0][0]) return keys[0][1]
    if (u >= keys[n - 1][0]) return keys[n - 1][1]
    let i = 0
    while (u > keys[i + 1][0]) i++
    const [u1, v1] = keys[i]
    const [u2, v2] = keys[i + 1]
    const v0 = keys[Math.max(0, i - 1)][1]
    const v3 = keys[Math.min(n - 1, i + 2)][1]
    const t = (u - u1) / (u2 - u1)
    const t2 = t * t, t3 = t2 * t
    return 0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 + (-v0 + 3 * v1 - 3 * v2 + v3) * t3)
  }
}
