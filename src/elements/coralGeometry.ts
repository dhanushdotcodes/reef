import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createNoise3D } from 'simplex-noise'
import { mulberry32 } from '../utils/random'
import { memo } from '../utils/cache'

export const CORAL_HEIGHT = [1.9, 0.9, 1.7] // reveal height per variant (branching, brain, fan)

function addAttrs(g: THREE.BufferGeometry, tone: (i: number) => number, tip: (i: number) => number) {
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  const t = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const k = tone(i)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
    t[i] = tip(i)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aTip', new THREE.BufferAttribute(t, 1))
}

/** (a) Branching: recursive curved tubes, 4 levels. */
function branching(seed: number): THREE.BufferGeometry {
  const rnd = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const MAX = 3
  const grow = (origin: THREE.Vector3, dir: THREE.Vector3, len: number, radius: number, level: number) => {
    const pts = [origin.clone()]
    const d = dir.clone()
    let p = origin.clone()
    for (let i = 0; i < 3; i++) {
      d.x += (rnd() - 0.5) * 0.55
      d.z += (rnd() - 0.5) * 0.55
      d.y += 0.18
      d.normalize()
      p = p.clone().addScaledVector(d, len / 3)
      pts.push(p)
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const tubular = 6, radial = 5
    const tube = new THREE.TubeGeometry(curve, tubular, radius, radial, false)
    const leaf = level === MAX
    addAttrs(
      tube,
      () => 0.82 + rnd() * 0.18,
      (i) => (leaf ? Math.pow(Math.floor(i / (radial + 1)) / tubular, 2) : level === 2 ? 0.1 : 0),
    )
    parts.push(tube)
    if (level < MAX) {
      const kids = level === 0 ? 3 : 2
      for (let k = 0; k < kids; k++) {
        const t = 0.4 + 0.55 * rnd()
        const o = curve.getPoint(t)
        const tan = curve.getTangent(t)
        const nd = tan.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.5, 0.1, (rnd() - 0.5) * 1.5)).normalize()
        grow(o, nd, len * 0.72, radius * 0.68, level + 1)
      }
    }
  }
  grow(new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 1, 0), 0.62, 0.075, 0)
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

/** (b) Brain: displaced sphere with ridged noise. */
function brain(seed: number): THREE.BufferGeometry {
  const noise = createNoise3D(mulberry32(seed))
  const g = new THREE.SphereGeometry(0.62, 48, 32)
  const pos = g.attributes.position as THREE.BufferAttribute
  const ridge = new Float32Array(pos.count)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const r = Math.pow(1 - Math.abs(noise(n.x * 3.4, n.y * 3.4, n.z * 3.4)), 3)
    ridge[i] = r
    v.addScaledVector(n, 0.09 * r)
    v.y *= 0.78
    if (v.y < -0.05) v.y = -0.05
    pos.setXYZ(i, v.x, v.y + 0.05, v.z)
  }
  g.computeVertexNormals()
  addAttrs(g, (i) => 0.68 + 0.32 * ridge[i], (i) => Math.max(0, ridge[i] - 0.7) * 1.4)
  return g
}

/** Cut-out lace pattern for the fan coral. Green channel is read as alpha. */
let fanAlpha: THREE.CanvasTexture | null = null
export function fanAlphaMap(): THREE.CanvasTexture {
  if (fanAlpha) return fanAlpha
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const c = cv.getContext('2d')!
  c.fillStyle = '#000'
  c.fillRect(0, 0, 256, 256)
  c.fillStyle = '#fff'
  // fan silhouette: apex at the bottom centre
  c.beginPath()
  c.moveTo(128, 254)
  c.arc(128, 254, 250, Math.PI * 1.17, Math.PI * 1.83)
  c.closePath()
  c.fill()
  // stem blob (stem uvs point here)
  c.fillRect(110, 236, 36, 20)
  c.strokeStyle = '#000'
  c.lineCap = 'round'
  for (let i = 0; i < 17; i++) {
    const a = Math.PI * (1.2 + (i / 16) * 0.6)
    c.lineWidth = 3
    c.setLineDash([26, 9])
    c.beginPath()
    c.moveTo(128 + Math.cos(a) * 55, 254 + Math.sin(a) * 55)
    c.lineTo(128 + Math.cos(a) * 250, 254 + Math.sin(a) * 250)
    c.stroke()
  }
  c.setLineDash([])
  for (const r of [95, 140, 185, 225]) {
    c.lineWidth = 4
    c.setLineDash([12, 18])
    c.beginPath()
    c.arc(128, 254, r, Math.PI * 1.17, Math.PI * 1.83)
    c.stroke()
  }
  fanAlpha = new THREE.CanvasTexture(cv)
  return fanAlpha
}

/** (c) Fan: bent flat plane (alpha cut-out) on a short stem. */
function fan(seed: number): THREE.BufferGeometry {
  const noise = createNoise3D(mulberry32(seed))
  const plane = new THREE.PlaneGeometry(1.6, 1.5, 24, 24)
  const pos = plane.attributes.position as THREE.BufferAttribute
  const tipV = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const yN = pos.getY(i) / 1.5 + 0.5 // 0..1
    const z = 0.22 * Math.sin(x * 2.1 + seed % 7) + yN * yN * 0.18 + noise(x * 1.5, yN * 1.5, 0) * 0.08
    pos.setXYZ(i, x, pos.getY(i) + 0.75 + 0.22, z)
    tipV[i] = Math.pow(yN, 3) * 0.8
  }
  addAttrs(plane, () => 0.95, (i) => tipV[i])
  const stem = new THREE.CylinderGeometry(0.05, 0.07, 0.35, 6, 1)
  stem.translate(0, 0.175, 0)
  const uv = stem.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.04)
  addAttrs(stem, () => 0.7, () => 0)
  const merged = mergeGeometries([plane, stem], false)
  plane.dispose()
  stem.dispose()
  return merged
}

export function coralGeometry(variant: number, seed: number): THREE.BufferGeometry {
  return memo(`coral:${variant}:${seed % 4096}`, () => [branching, brain, fan][variant % 3](seed % 4096))
}
